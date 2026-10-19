import {
  cloneTangle,
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
    svg.addEventListener('pointermove', (e) => this.onMove(e));
    svg.addEventListener('pointerup', (e) => this.onUp(e));
    svg.addEventListener('pointercancel', () => this.cancel());
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
    if (this.anim) cancelAnimationFrame(this.anim);
    this.anim = 0;
    this.paths = [];
    this.curPts = [];
    this.previewKey = '';
    for (let i = 0; i < this.tangle[0].length; i++) {
      const path = document.createElementNS(SVG_NS, 'path');
      const selected = this.selected.has(this.tangle[0][i]);
      const pts = this.particlePoints(i);
      this.curPts.push(pts);
      this.paths.push(path);
      path.setAttribute('d', this.pathData(pts));
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

  private paths: SVGPathElement[] = [];
  private curPts: Pt[][] = [];
  private anim = 0;
  private previewKey = '';

  // animate the strings toward the layout that results from dropping on `target`
  private preview(target: TanglePoint | undefined): void {
    const key = target && this.chosen ? `${target.permutationIndex},${target.particleIndex}` : '';
    if (key === this.previewKey) return;
    this.previewKey = key;
    let view = this.tangle;
    if (target && this.chosen) {
      view = cloneTangle(this.tangle);
      moveCrossing(view, this.chosen, target);
    }
    const saved = this.tangle;
    this.tangle = view;
    this.measure();
    const to = this.tangle[0].map((_, i) => this.particlePoints(i));
    this.tangle = saved;
    this.measure();
    // a move can add or remove rows, so resample both layouts to the same point count
    const n = Math.max(to[0].length, this.curPts[0].length);
    const resample = (pts: Pt[]): Pt[] =>
      Array.from({ length: n }, (_, j) => {
        const f = (j / (n - 1)) * (pts.length - 1);
        const a = Math.floor(f);
        const b = Math.min(a + 1, pts.length - 1);
        const u = f - a;
        return { x: pts[a].x + (pts[b].x - pts[a].x) * u, y: pts[a].y + (pts[b].y - pts[a].y) * u };
      });
    const goal = to;
    const from = this.curPts.map(resample);
    const toR = to.map(resample);
    const start = performance.now();
    const dur = 180;
    if (this.anim) cancelAnimationFrame(this.anim);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const k = t * (2 - t);
      this.curPts = toR.map((pts, i) =>
        pts.map((p, j) => ({ x: from[i][j].x + (p.x - from[i][j].x) * k, y: from[i][j].y + (p.y - from[i][j].y) * k })),
      );
      this.curPts.forEach((pts, i) =>
        this.paths[i]?.setAttribute('d', this.pathData(t < 1 ? pts : goal[i])),
      );
      if (t >= 1) this.curPts = goal;
      this.anim = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.anim = requestAnimationFrame(tick);
  }

  private dragging = false;
  private marker: SVGCircleElement | null = null;
  private downAt: Pt = { x: 0, y: 0 };

  private targetAt(p: Pt, radius: number): TanglePoint | undefined {
    let best: TanglePoint | undefined;
    let dist = Infinity;
    for (const t of this.targets) {
      const c = this.center(t);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < radius && d < dist) {
        dist = d;
        best = t;
      }
    }
    return best;
  }

  private placeMarker(p: Pt): void {
    if (!this.marker) return;
    const snap = this.targetAt(p, this.step * 0.5);
    this.preview(snap);
    const c = snap ? this.center(snap) : p;
    this.marker.setAttribute('cx', String(c.x));
    this.marker.setAttribute('cy', String(c.y));
  }

  private addMarker(c: Pt): void {
    const el = this.circle(c);
    el.setAttribute('class', 'hint drag');
    el.setAttribute('fill', 'rgba(255,255,255,.25)');
    this.svg.appendChild(el);
    this.marker = el;
  }

  private cancel(): void {
    this.chosen = null;
    this.targets = [];
    this.selected.clear();
    this.dragging = false;
    this.marker = null;
    this.draw();
  }

  private drop(p: Pt): void {
    const from = this.chosen;
    const target = from && this.targetAt(p, this.step * 0.5);
    if (from && target) {
      this.chosen = null;
      this.targets = [];
      this.selected.clear();
      this.dragging = false;
      this.marker = null;
      moveCrossing(this.tangle, from, target);
      this.refresh(true);
    } else {
      this.cancel();
    }
  }

  private onPointer(e: PointerEvent): void {
    if (this.won || this.locked) return;
    const p = this.toSvg(e);
    const hit = this.step;

    if (this.chosen) {
      // second tap of tap-to-move
      this.drop(p);
      return;
    }

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
    if (!best || dist >= hit) return;
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
    this.dragging = true;
    this.downAt = p;
    this.addMarker(this.center(best));
    this.svg.setPointerCapture(e.pointerId);
  }

  private onMove(e: PointerEvent): void {
    if (this.dragging) this.placeMarker(this.toSvg(e));
  }

  private onUp(e: PointerEvent): void {
    if (!this.dragging) return;
    const p = this.toSvg(e);
    this.dragging = false;
    if (Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < this.step * 0.3) {
      // a tap: stay selected, wait for a second tap
      this.marker?.remove();
      this.marker = null;
      return;
    }
    this.drop(p);
  }
}
