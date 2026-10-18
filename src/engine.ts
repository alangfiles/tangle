// Port of Utils/ManipulationsWithTangle.cs and TangleSolver.cs.
// A tangle is a list of permutations (rows, top to bottom); each particle
// moves by at most one position between consecutive rows.

export type Tangle = number[][];

export interface TanglePoint {
  particleIndex: number;
  permutationIndex: number;
}

const pt = (particleIndex: number, permutationIndex: number): TanglePoint => ({ particleIndex, permutationIndex });

export function cloneTangle(t: Tangle): Tangle {
  return t.map((p) => p.slice());
}

export function tangleToString(t: Tangle): string {
  return t.map((p) => p.join(' ')).join('\n');
}

export function tangleFromString(s: string): Tangle {
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(/\s+/).map(Number));
}

// ---------- solver ----------

function sortedIndicesSolution(initial: number[], forward: boolean): Tangle {
  const len = initial.length;
  const list: Tangle = [];
  let current: number[];
  let needSwap: (i: number) => boolean;
  if (forward) {
    current = initial.slice();
    list.push(current.slice());
    needSwap = (i) => i < len - 1 && current[i] > current[i + 1];
  } else {
    const positions = new Map<number, number>();
    initial.forEach((v, i) => positions.set(v, i));
    current = initial.slice().sort((a, b) => a - b);
    list.push(current.slice());
    needSwap = (i) => i < len - 1 && positions.get(current[i])! > positions.get(current[i + 1])!;
  }
  let done = false;
  while (!done) {
    done = true;
    for (let i = 0; i < len; i++) {
      if (needSwap(i)) {
        [current[i], current[i + 1]] = [current[i + 1], current[i]];
        i++;
        done = false;
      }
    }
    list.push(current.slice());
  }
  list.push(current.slice());
  if (forward) list.reverse();
  keepEnoughIdenticalPermutationsAboveAndBelow(list);
  return list;
}

export function solveForward(initial: number[]): Tangle {
  return sortedIndicesSolution(initial, true);
}

export function solveBackward(initial: number[]): Tangle {
  return sortedIndicesSolution(initial, false);
}

// ---------- movable crossings ----------

export function getMovableCrossings(t: Tangle): TanglePoint[] {
  const result: TanglePoint[] = [];
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    for (let j = 0; j < a.length - 1; j++)
      if (a[j] === b[j + 1] && crossingIsMovable(i, a[j], a[j + 1], t)) result.push(pt(j, i));
  }
  return result;
}

function crossingIsMovable(permIndex: number, left: number, right: number, t: Tangle): boolean {
  for (let target = 0; target < t.length - 1; target++) {
    if (target === permIndex) continue;
    // above the crossing the pair is in the same order, below it is reversed
    const l = target < permIndex ? left : right;
    const r = target < permIndex ? right : left;
    const a = t[target];
    const b = t[target + 1];
    for (let j = 0; j < a.length - 1; j++)
      if (a[j] === l && a[j + 1] === r && b[j] === l && b[j + 1] === r) return true;
  }
  return false;
}

/** Places where the crossing of `left`,`right` (at `upperIndex`) may be moved to. */
export function createTargetsForCrossingMove(
  upperIndex: number,
  left: number,
  right: number,
  t: Tangle,
): TanglePoint[] {
  const list: TanglePoint[] = [];
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    const l = i > upperIndex ? right : left;
    const r = i > upperIndex ? left : right;
    for (let j = 0; j < a.length - 1; j++) {
      if (a[j] === l && a[j + 1] === r && b[j] === l && b[j + 1] === r) {
        list.push(pt(j, i));
        break;
      }
    }
  }
  return list;
}

// ---------- moves ----------

export function locate(p: number[], particle: number, hint: number): number {
  if (p[hint] === particle) return hint;
  if (hint > 0 && p[hint - 1] === particle) return hint - 1;
  if (hint < p.length - 1 && p[hint + 1] === particle) return hint + 1;
  throw new Error('it is not a continuous tangle');
}

function swapInRow(a: number, b: number, hints: { ai: number; bi: number }, p: number[]): void {
  hints.ai = locate(p, a, hints.ai);
  hints.bi = locate(p, b, hints.bi);
  [p[hints.ai], p[hints.bi]] = [p[hints.bi], p[hints.ai]];
}

export function swapGoingUp(t: Tangle, current: TanglePoint, target: TanglePoint): void {
  const row = t[current.permutationIndex];
  const a = row[current.particleIndex];
  const b = row[current.particleIndex + 1];
  const h = { ai: current.particleIndex + 1, bi: current.particleIndex };
  for (let j = current.permutationIndex; j > target.permutationIndex; j--) swapInRow(a, b, h, t[j]);
  keepEnoughIdenticalPermutationsAboveAndBelow(t);
}

export function swapGoingDown(t: Tangle, current: TanglePoint, target: TanglePoint): void {
  const row = t[current.permutationIndex];
  const a = row[current.particleIndex];
  const b = row[current.particleIndex + 1];
  const h = { ai: current.particleIndex + 1, bi: current.particleIndex };
  for (let j = current.permutationIndex + 1; j <= target.permutationIndex; j++) swapInRow(a, b, h, t[j]);
  keepEnoughIdenticalPermutationsAboveAndBelow(t);
}

export function moveCrossing(t: Tangle, from: TanglePoint, to: TanglePoint): void {
  if (from.permutationIndex < to.permutationIndex) swapGoingDown(t, from, to);
  else swapGoingUp(t, from, to);
}

// ---------- corners ----------

export function getNumberOfCorners(t: Tangle): { corners: number; nice: boolean } {
  if (t.length <= 1) return { corners: 0, nice: true };
  const positions = t.map((row) => {
    const m = new Map<number, number>();
    row.forEach((v, i) => m.set(v, i));
    return m;
  });
  let corners = 0;
  let nice = true;
  for (const particle of t[0]) {
    const r = cornersOfParticle(particle, positions, t.length);
    corners += r.corners;
    if (!r.nice) nice = false;
  }
  return { corners, nice };
}

function cornersOfParticle(
  particle: number,
  positions: Map<number, number>[],
  rows: number,
): { corners: number; nice: boolean } {
  let r = 0;
  let turnedLeft = false;
  let turnedRight = false;
  for (let i = 1; i < rows - 1; i++) {
    const pmin = positions[i - 1].get(particle)!;
    const p = positions[i].get(particle)!;
    const pplus = positions[i + 1].get(particle)!;
    if (p - pmin !== pplus - p) r++;
    if (p - pmin < 0) turnedLeft = true;
    else if (p - pmin > 0) turnedRight = true;
  }
  if (r === 0) return { corners: 0, nice: true };
  if (r === 2) return { corners: 2, nice: true };
  if (r === 4) return { corners: 4, nice: turnedLeft && turnedRight };
  return { corners: r, nice: false };
}

// ---------- padding rows ----------

const same = (a: number[], b: number[]): boolean => a.every((v, i) => v === b[i]);

export function keepEnoughIdenticalPermutationsAboveAndBelow(t: Tangle): void {
  if (!same(t[0], t[1])) t.unshift(t[0].slice());
  else removeAbove(t);
  if (!same(t[t.length - 2], t[t.length - 1])) t.push(t[t.length - 1].slice());
  else removeBelow(t);
}

function removeAbove(t: Tangle): void {
  while (t.length > 2 && same(t[1], t[2])) t.splice(2, 1);
}

function removeBelow(t: Tangle): void {
  while (t.length > 2 && same(t[t.length - 3], t[t.length - 2])) t.pop();
}
