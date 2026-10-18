// Regenerates src/levels.json from the original topList using the original selection rule.
import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync(new URL('./topList', import.meta.url), 'utf8').split(/\r?\n/);
const levels = [];
let i = 1;
let j = 1;
for (let k = 0; k + 1 < lines.length; k += 2) {
  const [dir, min] = lines[k].trim().split(' ');
  const perm = lines[k + 1];
  if (i % 9 === 0 || perm.length > 25 || i < 5) {
    levels.push({
      index: j++,
      solveForward: dir === 'f',
      permutation: perm.trim().split(/\s+/).map(Number),
      minimalCorners: Number(min),
    });
  }
  i++;
}
writeFileSync(new URL('../src/levels.json', import.meta.url), JSON.stringify(levels));
console.log(`wrote ${levels.length} levels`);
