import './style.css';
import { Board } from './board';
import { tangleFromString, tangleToString } from './engine';
import { initialTangle, levels, type Level } from './levels';
import { getProgress, resetProgress, saveProgress } from './storage';

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

const fmt = (sec: number): string => {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, ...rest } = props;
  if (cls) node.className = cls;
  Object.assign(node, rest);
  node.append(...children);
  return node;
}

function header(title: string, small = 'Tangle', sm = true): HTMLElement {
  return el('header', {}, el('p', { class: 'small' }, small), el('h1', { class: sm ? 'title sm' : 'title' }, title));
}

function startScreen(): void {
  const next = levels.find((l) => !getProgress(l.index).won) ?? levels[0];
  app.append(
    header('tangle', 'Untangle the wires', false),
    el('p', { class: 'subtitle' }, 'move crossings to reduce corners'),
    el('div', {},
      el('a', { class: 'btn', href: `#/level/${next.index}` }, 'play'),
      el('a', { class: 'btn ghost', href: '#/levels' }, 'levels'),
      el('a', { class: 'btn ghost', href: '#/help' }, 'how to play'),
      el('a', { class: 'btn ghost', href: '#/about' }, 'about')),
  );
}

function levelsScreen(): void {
  const grid = el('div', { class: 'grid' });
  for (const l of levels) {
    const p = getProgress(l.index);
    grid.append(
      el('a', { class: `tile${p.won ? ' won' : ''}`, href: `#/level/${l.index}` },
        el('span', { class: 'n' }, String(l.index)),
        el('span', { class: 't' }, p.elapsed > 0 ? fmt(p.elapsed) : '')),
    );
  }
  app.append(header('pick a level'), grid);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function helpDiagram(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 90');
  const add = (tag: string, attrs: Record<string, string>) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.appendChild(n);
  };
  add('path', { d: 'M30 5 V30 L60 55 V85', stroke: '#e1255b', 'stroke-width': '4', fill: 'none' });
  add('path', { d: 'M60 5 V30 L30 55 V85', stroke: '#16af69', 'stroke-width': '4', fill: 'none' });
  add('circle', { cx: '45', cy: '42', r: '9', stroke: '#fff', 'stroke-width': '3', fill: 'none' });
  return svg;
}

function helpScreen(): void {
  app.append(
    header('how to play', 'Tangle'),
    el('div', { class: 'help' },
      helpDiagram(),
      el('p', {}, 'The wires are pinned at the top and at the bottom, but their crossings can be moved around.'),
      el('p', {}, 'The goal is to minimize the number of ', el('b', {}, 'corners'), ': points where a wire changes direction.'),
      el('p', {}, el('b', {}, 'Movable'), ' crossings are shown with circles. Tap a crossing to select it.'),
      el('p', {}, 'Now the circles show places where the crossing of these two wires may move to. Tap a place to move the crossing.'),
      el('p', {}, 'Keep going until "corners to go" is reduced to 0.'),
      el('a', { class: 'btn', href: '#/levels' }, 'pick a level'),
      el('a', { class: 'btn ghost', href: '#/about' }, 'about')),
  );
}

function wireDiagram(points: [number, number][], caption: string): HTMLElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 90');
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', points.map((p) => p.join(',')).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#00b0f0');
  line.setAttribute('stroke-width', '4');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if ((x1 - x0) * (y2 - y1) === (y1 - y0) * (x2 - x1)) continue; // straight through
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(x1));
    dot.setAttribute('cy', String(y1));
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', 'none');
    dot.setAttribute('stroke', '#fe0000');
    dot.setAttribute('stroke-width', '2.5');
    svg.appendChild(dot);
  }
  return el('figure', { class: 'fig' }, svg, el('figcaption', {}, caption));
}

function aboutScreen(): void {
  app.append(
    header('about tangle'),
    el('div', { class: 'help about' },
      el('h2', {}, 'The goal'),
      el('p', {}, 'Each colored wire is pinned at the top and at the bottom. In between, the wires cross each other and zigzag around. Your job is to straighten the tangle out so the wires follow the simplest possible paths.'),
      el('h2', {}, 'What is a corner?'),
      el('p', {}, 'A ', el('b', {}, 'corner'), ' is a point where a wire changes direction: going straight down, then slanting left or right, or slanting one way and then the other. The red circles below mark the corners.'),
      el('div', { class: 'figs' },
        wireDiagram([[30, 5], [30, 20], [50, 35], [50, 55], [70, 70], [70, 85]], '4 corners'),
        wireDiagram([[30, 5], [30, 25], [70, 65], [70, 85]], '2 corners')),
      el('p', {}, 'Both wires above start and end in the same places, but the second one gets there with fewer corners. That is what you are after.'),
      el('h2', {}, 'Reducing corners'),
      el('p', {}, 'You can\'t move the wires directly. Instead you slide the ', el('b', {}, 'crossings'), ' where two wires cross. Moving a crossing to a different spot along the same two wires reshapes their paths, and that can remove corners or add them. The counter at the bottom of the game shows how many corners you still need to remove ("corners to go").'),
      el('h2', {}, 'Winning'),
      el('p', {}, 'When the counter reaches 0, the tangle is as simple as it can get and you win. Every level is solvable, and later levels have more wires and more crossings, so they take more planning. Sometimes you have to add a corner first to remove two later.'),
      el('a', { class: 'btn', href: '#/levels' }, 'pick a level'),
      el('a', { class: 'btn ghost', href: '#/help' }, 'how to play')),
  );
}

function gameScreen(level: Level): void {
  const progress = getProgress(level.index);
  const tangle = progress.tangle ? tangleFromString(progress.tangle) : initialTangle(level);

  const cornerText = el('span', {});
  const timerText = el('span', {}, fmt(progress.elapsed));
  const victory = el('div', { class: 'victory' },
    el('div', { class: 'check' }, '✔'),
    el('div', { class: 'btns' }),
  );
  const nextLevel = levels.find((l) => l.index === level.index + 1);
  victory.querySelector('.btns')!.append(
    ...(nextLevel ? [el('a', { class: 'btn', href: `#/level/${nextLevel.index}` }, 'next level')] : []),
    el('a', { class: 'btn ghost', href: '#/levels' }, 'levels'),
  );
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'board');

  let elapsed = progress.elapsed;
  let won = progress.won;
  let lastTick = performance.now();
  let current = tangle;

  let restarting = false;
  const persist = () => !restarting && saveProgress(level.index, { won, elapsed, tangle: tangleToString(current) });

  const showState = (cornersToGo: number, isWon: boolean) => {
    won = isWon;
    cornerText.className = isWon ? 'win' : '';
    cornerText.textContent = isWon ? 'You won!' : `${cornersToGo} corners to go`;
    victory.classList.toggle('on', isWon);
  };

  const board = new Board(svg, tangle, level.minimalCorners, (s, t) => {
    current = t;
    showState(s.cornersToGo, s.won);
    persist();
  }, false);

  const initial = board.state();
  showState(initial.cornersToGo, initial.won);

  const reset = el('button', { class: 'btn ghost', type: 'button' }, 'restart');
  reset.onclick = () => {
    restarting = true;
    resetProgress(level.index);
    location.reload();
  };

  app.append(
    el('div', { class: 'bar' }, header(`level ${level.index}`), el('a', { href: '#/levels', class: 'small' }, '‹ levels')),
    el('div', { class: 'game' }, svg, victory),
    el('div', { class: 'info' }, cornerText, reset, timerText),
  );

  const timer = window.setInterval(() => {
    const now = performance.now();
    if (!won && !document.hidden) {
      elapsed += (now - lastTick) / 1000;
      timerText.textContent = fmt(elapsed);
    }
    lastTick = now;
  }, 1000);
  const save = () => persist();
  window.addEventListener('pagehide', save);
  cleanup = () => {
    clearInterval(timer);
    window.removeEventListener('pagehide', save);
    persist();
  };
}

function route(): void {
  cleanup?.();
  cleanup = null;
  app.replaceChildren();
  const hash = location.hash.replace(/^#/, '') || '/';
  const m = hash.match(/^\/level\/(\d+)$/);
  const level = m ? levels.find((l) => l.index === Number(m[1])) : undefined;
  if (level) gameScreen(level);
  else if (hash === '/levels') levelsScreen();
  else if (hash === '/help') helpScreen();
  else if (hash === '/about') aboutScreen();
  else startScreen();
}

window.addEventListener('hashchange', route);
route();
