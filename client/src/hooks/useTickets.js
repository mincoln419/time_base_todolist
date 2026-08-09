import { useState, useEffect, useCallback } from 'react';
import { fetchTickets, createTicket } from '../api/customers';
import { toggleTicket, updateDesiredDate, deleteTicket } from '../api/tickets';

export function useTickets(customerId) {
  const [tickets, setTickets] = useState([]);

  const load = useCallback(async () => {
    if (customerId == null) { setTickets([]); return; }
    setTickets(await fetchTickets(customerId));
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const addTicket = useCallback(async (title, desiredDate) => {
    const ticket = await createTicket(customerId, title, desiredDate);
    setTickets((prev) => [...prev, ticket]);
    return ticket;
  }, [customerId]);

  const toggle = useCallback(async (id) => {
    const updated = await toggleTicket(id);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const setDesiredDate = useCallback(async (id, desiredDate) => {
    const updated = await updateDesiredDate(id, desiredDate);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const removeTicket = useCallback(async (id) => {
    await deleteTicket(id);
    setTickets((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tickets, addTicket, toggle, setDesiredDate, removeTicket };
}
