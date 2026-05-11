import { useState, useEffect, useCallback } from 'react';
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules';

export function useSchedules(date) {
  const [schedules, setSchedules] = useState([]);

  const load = useCallback(async () => {
    if (!date) return;
    setSchedules(await fetchSchedules(date));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const addSchedule = useCallback(async ({ task_id, start_hour, end_hour }) => {
    const s = await createSchedule({ task_id, date, start_hour, end_hour });
    setSchedules((prev) => [...prev, s].sort((a, b) => a.start_hour - b.start_hour));
    return s;
  }, [date]);

  const changeStatus = useCallback(async (id, status) => {
    const s = await updateSchedule(id, { status });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)));
  }, []);

  const changeTime = useCallback(async (id, start_hour, end_hour) => {
    const s = await updateSchedule(id, { start_hour, end_hour });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)).sort((a, b) => a.start_hour - b.start_hour));
  }, []);

  const removeSchedule = useCallback(async (id) => {
    await deleteSchedule(id);
    setSchedules((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return { schedules, addSchedule, changeStatus, changeTime, removeSchedule };
}
