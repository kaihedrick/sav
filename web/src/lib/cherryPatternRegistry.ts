/** Align tiled sakura across cards: one rAF batch notifies all layers to recompute document Y offset */

const listeners = new Set<() => void>();

export function registerCherryPatternAlign(fn: () => void): () => void {
  listeners.add(fn);
  queueMicrotask(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyCherryPatternAlign(): void {
  listeners.forEach((fn) => fn());
}
