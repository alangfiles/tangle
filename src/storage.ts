export interface Progress {
  won: boolean;
  elapsed: number;
  tangle: string | null;
}

const KEY = 'tangles-web-progress-v1';

type Store = Record<number, Progress>;

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

export function getProgress(index: number): Progress {
  return load()[index] ?? { won: false, elapsed: 0, tangle: null };
}

export function saveProgress(index: number, p: Progress): void {
  const store = load();
  store[index] = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage unavailable (private mode / quota); the game still works for this session
  }
}

export function resetProgress(index: number): void {
  const store = load();
  delete store[index];
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}
