import { useState, useEffect, useCallback } from 'react';
import { fetchFocusMap, saveFocusMap, resetFocusMap } from '../api/focusMap';

const EMPTY_STATE = { goal: '', items: [], step: 0, cursor: 0 };

export function useFocusMap() {
  const [state, setState] = useState(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchFocusMap()
      .then((saved) => { if (saved) setState(saved); })
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveFocusMap(next).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    resetFocusMap().catch(() => {});
    setState(EMPTY_STATE);
  }, []);

  return { state, loaded, update, reset };
}
