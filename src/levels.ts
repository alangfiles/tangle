import data from './levels.json';
import { solveBackward, solveForward, type Tangle } from './engine';

export interface Level {
  index: number;
  solveForward: boolean;
  permutation: number[];
  minimalCorners: number;
}

export const levels: Level[] = data as Level[];

export function initialTangle(level: Level): Tangle {
  return level.solveForward ? solveForward(level.permutation) : solveBackward(level.permutation);
}
