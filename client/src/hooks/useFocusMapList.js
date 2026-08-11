import { useState, useEffect, useCallback } from 'react';
import { listFocusMaps, deleteFocusMap } from '../api/focusMap';

export function useFocusMapList() {
  const [list, setList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setList(await listFocusMaps());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { refresh().finally(() => setLoaded(true)); }, [refresh]);

  const removeFocusMap = useCallback(async (id) => {
    try {
      await deleteFocusMap(id);
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  return { list, loaded, error, refresh, removeFocusMap };
}
