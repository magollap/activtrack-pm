import { useCallback, useEffect, useRef } from 'react';

/** Debounces a save callback and flushes any pending call on unmount so edits are never dropped. */
export function useDebouncedSave<T>(save: (value: T) => void, delay = 500): { schedule: (value: T) => void; flush: () => void } {
  const saveRef = useRef(save);
  saveRef.current = save;
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) {
      const { value } = pending.current;
      pending.current = null;
      saveRef.current(value);
    }
  }, []);

  const schedule = useCallback((value: T) => {
    pending.current = { value };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [delay, flush]);

  useEffect(() => flush, [flush]);

  return { schedule, flush };
}
