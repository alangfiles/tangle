import {
  createTargetsForCrossingMove,
  getMovableCrossings,
  getNumberOfCorners,
  moveCrossing,
  locate,
  type Tangle,
  type TanglePoint,
} from './engine';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 480;
const HEIGHT = 640;
const MARGIN = 5;
const ALPHA = 0.2;

const PALETTE = [
  '#e1255b', '#a61a1a', '#fe0000', '#fd8328', '#e0ee00', '#54e901', '#16af69',
  '#00b0f0', '#0909fd', '#3d3dfd', '#6c4aca', '#b31ecc', '#a4a6a6',
];

interface Pt {
  x: number;
  y: number;
}

export interface BoardState {
  cornersToGo: number;
  won: boolean;
}

export class Board {
  private step = 0;
  private strokeWidth = 0;
  private colors: string[] = [];
  private movable: TanglePoint[] = [];
  private chosen: TanglePoint | null = null;
  private targets: TanglePoint[] = [];
  private selected = new Set<number>();
  private won = false;

  constructor(
    private readonly svg: SVGSVGElement,
    private tangle: Tangle,
    private readonly minimalCorners: number,
    private readonly onChange: (state: BoardState, tangle: Tangle) => void,
    private locked: boolean,
  ) {
    svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
    svg.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.initColors();
    this.refresh(false);
  }

  private initColors(): void {
    const n = this.tangle[0].length;
    const del = Math.max(1, Math.floor((PALETTE.length - 1) / (n - 1)));
    this.colors = Array.from({ length: n }, (_, i) => PALETTE[Math.min(i * del, PALETTE.length - 1)]);
  }

  private refresh(notify: boolean): void {
    this.movable = getMovableCrossings(this.tangle);
    const { corners, nice } = getNumberOfCorners(this.tangle);
    this.won = nice;
    this.measure();
    this.draw();
    if (notify) this.onChange({ cornersToGo: corners - this.minimalCorners, won: nice }, this.tangle);
  }

  state(): BoardState {
    const { corners, nice } = getNumberOfCorners(this.tangle);
    return { cornersToGo: corners - this.minimalCorners, won: nice };
  }

  private measure(): void {
    const hStep = (WIDTH - 2 * MARGIN) / (this.tangle[0].length - 1);
    const vStep = (HEIGHT - 2 * MARGIN) / (this.tangle.length - 1);
    this.step = Math.min(hStep, vStep);
    this.strokeWidth = this.step / 10;
  }

  private x(particleIndex: number): number {
    return (WIDTH - this.step * (this.tangle[0].length - 1)) / 2 + this.step * particleIndex;
  }

  private y(permIndex: number): number {
    return (HEIGHT - this.step * (this.tangle.length - 1)) / 2 + this.step * permIndex;
  }

  // crossings sit halfway between two columns and two rows
  private center(p: TanglePoint): Pt {
    return { x: this.x(p.particleIndex) + this.step / 2, y: this.y(p.permutationIndex) + this.step / 2 };
  }

  private particlePoints(particleIndex: number): Pt[] {
    const id = this.tangle[0][particleIndex];
    let idx = particleIndex;
    return this.tangle.map((row, i) => {
      idx = locate(row, id, idx);
      return { x: this.x(idx), y: this.y(i) };
    });
  }

  private pathData(points: Pt[]): string {
    const f = (n: number) => n.toFixed(2);
    let d = `M${f(points[0].x)} ${f(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (i === points.length - 1) {
        d += ` L${f(p.x)} ${f(p.y)}`;
        break;
      }
      const p0 = points[i - 1];
      const p1 = points[i + 1];
      const ps = { x: ALPHA * p0.x + (1 - ALPHA) * p.x, y: ALPHA * p0.y + (1 - ALPHA) * p.y };
      const pe = { x: ALPHA * p1.x + (1 - ALPHA) * p.x, y: ALPHA * p1.y + (1 - ALPHA) * p.y };
      const t0 = { x: 0.34 * ps.x + 0.66 * p.x, y: 0.34 * ps.y + 0.66 * p.y };
      const t1 = { x: 0.34 * pe.x + 0.66 * p.x, y: 0.34 * pe.y + 0.66 * p.y };
      d += ` L${f(ps.x)} ${f(ps.y)} C${f(t0.x)} ${f(t0.y)} ${f(t1.x)} ${f(t1.y)} ${f(pe.x)} ${f(pe.y)}`;
    }
    return d;
  }

  private circle(c: Pt): SVGCircleElement {
    const el = document.createElementNS(SVG_NS, 'circle');
    el.setAttribute('cx', String(c.x));
    el.setAttribute('cy', String(c.y));
    el.setAttribute('r', String(this.step / 4));
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', '#fff');
    el.setAttribute('stroke-width', String(this.strokeWidth));
    el.setAttribute('class', 'hint');
    return el;
  }

  private draw(): void {
    this.svg.replaceChildren();
    for (let i = 0; i < this.tangle[0].length; i++) {
      const path = document.createElementNS(SVG_NS, 'path');
      const selected = this.selected.has(this.tangle[0][i]);
      path.setAttribute('d', this.pathData(this.particlePoints(i)));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', this.colors[i]);
      path.setAttribute('stroke-width', String(selected ? this.strokeWidth * 2 : this.strokeWidth));
      this.svg.appendChild(path);
    }
    if (this.won || this.locked) return;
    const hints = this.chosen ? this.targets : this.movable;
    for (const h of hints) this.svg.appendChild(this.circle(this.center(h)));
  }

  private toSvg(e: PointerEvent): Pt {
    const m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  private onPointer(e: PointerEvent): void {
    if (this.won || this.locked) return;
    const p = this.toSvg(e);
    const hit = this.step; // hit radius: twice the hint circle radius

    if (!this.chosen) {
      let best: TanglePoint | null = null;
      let dist = Infinity;
      for (const m of this.movable) {
        const c = this.center(m);
        const d = Math.abs(p.x - c.x) + Math.abs(p.y - c.y);
        if (d < dist) {
          dist = d;
          best = m;
        }
      }
      if (best && dist < hit) {
        const row = this.tangle[best.permutationIndex];
        this.chosen = best;
        this.selected = new Set([row[best.particleIndex], row[best.particleIndex + 1]]);
        this.targets = createTargetsForCrossingMove(
          best.permutationIndex,
          row[best.particleIndex],
          row[best.particleIndex + 1],
          this.tangle,
        );
        this.draw();
      }
      return;
    }

    const from = this.chosen;
    const target = this.targets.find((t) => {
      const c = this.center(t);
      return Math.abs(p.x - c.x) <= hit / 2 && Math.abs(p.y - c.y) <= hit / 2;
    });
    this.chosen = null;
    this.targets = [];
    this.selected.clear();
    if (target) {
      moveCrossing(this.tangle, from, target);
      this.refresh(true);
    } else {
      this.draw();
    }
  }
}
