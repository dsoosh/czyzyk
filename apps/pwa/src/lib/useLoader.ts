import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export interface Loaded<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Runs `load` whenever deps change; ignores results of superseded runs. */
export function useLoader<T>(load: () => Promise<T>, deps: DependencyList): Loaded<T> {
  const [state, setState] = useState<{ data?: T; error: string | null; loading: boolean }>({ error: null, loading: true });
  const run = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = useCallback(load, deps);

  const reload = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true }));
    stableLoad().then(
      (data) => id === run.current && setState({ data, error: null, loading: false }),
      () => id === run.current && setState((s) => ({ ...s, error: "Nie udało się wczytać danych.", loading: false })),
    );
  }, [stableLoad]);

  useEffect(reload, [reload]);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}

/** Calls `fn` whenever the app returns to the foreground. */
export function useOnForeground(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const handler = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
}
