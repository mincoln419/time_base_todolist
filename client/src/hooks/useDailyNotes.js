import { useState, useEffect, useCallback } from 'react';
import { fetchDailyNotes, createDailyNote, updateDailyNote, deleteDailyNote } from '../api/dailyNotes';

export function useDailyNotes() {
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setNotes(await fetchDailyNotes());
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNote = useCallback(async (note) => {
    const created = await createDailyNote(note);
    setNotes((prev) => [created, ...prev]);
    return created;
  }, []);

  const editNote = useCallback(async (id, note) => {
    const updated = await updateDailyNote(id, note);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  }, []);

  const removeNote = useCallback(async (id) => {
    await deleteDailyNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notes, loaded, addNote, editNote, removeNote };
}
