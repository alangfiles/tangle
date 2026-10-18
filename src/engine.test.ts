import { describe, expect, it } from 'vitest';
import {
  cloneTangle,
  createTargetsForCrossingMove,
  getMovableCrossings,
  getNumberOfCorners,
  moveCrossing,
  tangleFromString,
  tangleToString,
  type Tangle,
} from './engine';
import { initialTangle, levels } from './levels';

const isContinuous = (t: Tangle): boolean =>
  t.every((row, i) => {
    if (i === 0) return true;
    return row.every((p, j) => Math.abs(t[i - 1].indexOf(p) - j) <= 1);
  });

describe('levels', () => {
  it('are loaded using the original selection rule', () => {
    expect(levels.length).toBe(67);
    expect(levels[0].permutation).toEqual([2, 1, 4, 3, 0]);
    expect(levels[0].minimalCorners).toBe(14);
  });

  it('start in a valid, not yet solved state', () => {
    for (const level of levels) {
      const t = initialTangle(level);
      expect(isContinuous(t)).toBe(true);
      const { corners } = getNumberOfCorners(t);
      expect(corners).toBeGreaterThanOrEqual(level.minimalCorners);
    }
  });
});

describe('moves', () => {
  it('keep the tangle continuous and the endpoints fixed, through random play', () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (const level of levels.slice(0, 40)) {
      const t = initialTangle(level);
      const top = t[0].slice();
      const bottom = t[t.length - 1].slice();
      for (let step = 0; step < 50; step++) {
        const movable = getMovableCrossings(t);
        if (movable.length === 0) break;
        const from = movable[rnd(movable.length)];
        const row = t[from.permutationIndex];
        const targets = createTargetsForCrossingMove(
          from.permutationIndex,
          row[from.particleIndex],
          row[from.particleIndex + 1],
          t,
        );
        moveCrossing(t, from, targets[rnd(targets.length)]);
        expect(isContinuous(t)).toBe(true);
      }
      expect(t[0]).toEqual(top);
      expect(t[t.length - 1]).toEqual(bottom);
      expect(t[0]).toEqual(t[1]);
      expect(t[t.length - 1]).toEqual(t[t.length - 2]);
    }
  });

  it('can be solved (reach a "nice" state with the minimal corner count) on the first levels', () => {
    for (const level of levels.slice(0, 4)) {
      const start = initialTangle(level);
      const seen = new Set<string>([tangleToString(start)]);
      let frontier: Tangle[] = [start];
      let solved = false;
      for (let depth = 0; depth < 12 && !solved && frontier.length < 20000; depth++) {
        const next: Tangle[] = [];
        for (const t of frontier) {
          for (const from of getMovableCrossings(t)) {
            const row = t[from.permutationIndex];
            for (const to of createTargetsForCrossingMove(
              from.permutationIndex,
              row[from.particleIndex],
              row[from.particleIndex + 1],
              t,
            )) {
              const c = cloneTangle(t);
              moveCrossing(c, from, to);
              const key = tangleToString(c);
              if (seen.has(key)) continue;
              seen.add(key);
              const r = getNumberOfCorners(c);
              if (r.nice && r.corners === level.minimalCorners) solved = true;
              next.push(c);
            }
          }
        }
        frontier = next;
      }
      expect(solved).toBe(true);
    }
  });
});

describe('serialization', () => {
  it('round-trips', () => {
    const t = initialTangle(levels[3]);
    expect(tangleFromString(tangleToString(t))).toEqual(t);
  });
});
