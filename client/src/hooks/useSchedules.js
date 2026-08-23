import { useState, useEffect, useCallback } from 'react';
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules';

export function useSchedules(date) {
  const [schedules, setSchedules] = useState([]);

  const load = useCallback(async () => {
    if (!date) return;
    setSchedules(await fetchSchedules(date));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const addSchedule = useCallback(async ({ title, start_min, end_min }) => {
    const s = await createSchedule({ title, date, start_min, end_min });
    setSchedules((prev) => [...prev, s].sort((a, b) => a.start_min - b.start_min));
    return s;
  }, [date]);

  const changeStatus = useCallback(async (id, status) => {
    const s = await updateSchedule(id, { status });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)));
  }, []);

  const changeTime = useCallback(async (id, start_min, end_min) => {
    const s = await updateSchedule(id, { start_min, end_min });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)).sort((a, b) => a.start_min - b.start_min));
  }, []);

  const removeSchedule = useCallback(async (id) => {
    await deleteSchedule(id);
    setSchedules((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { schedules, addSchedule, changeStatus, changeTime, removeSchedule };
}
