import { COLLECTION_NAMES, type CollectionName } from '@/lib/db/types';

type Listener = (collection: CollectionName) => void;

const listeners = new Set<Listener>();

export function emitChange(collection: CollectionName): void {
  listeners.forEach((listener) => listener(collection));
}

export function emitAll(): void {
  COLLECTION_NAMES.forEach(emitChange);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Pick up changes teammates made while this tab was in the background.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') emitAll();
  });
}
