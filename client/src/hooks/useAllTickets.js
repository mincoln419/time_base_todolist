import { useState, useEffect, useCallback } from 'react';
import { fetchAllTickets } from '../api/tickets';

export function useAllTickets() {
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setTickets(await fetchAllTickets());
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { tickets, loaded, reload: load };
}
