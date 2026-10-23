import { useEffect, useRef, useState } from 'react';
import { subscribe } from '@/lib/db/events';
import { errorMessage } from '@/lib/errors';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

/** Runs an async data loader and re-runs it whenever any collection changes (in this or another tab). */
export function useQuery<T>(load: () => Promise<T>, key: string): QueryState<T> {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: null, loading: true });

  useEffect(() => {
    let active = true;
    let scheduled = false;
    setState((s) => ({ ...s, loading: true }));

    const run = () => {
      loadRef
        .current()
        .then((data) => active && setState({ data, error: null, loading: false }))
        .catch((e: unknown) => active && setState({ data: undefined, error: errorMessage(e), loading: false }));
    };
    run();

    const unsubscribe = subscribe(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (active) run();
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [key]);

  return state;
}
