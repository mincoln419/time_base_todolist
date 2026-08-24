import { useCallback, useEffect, useState } from 'react';
import {
  completeWorry,
  createWorry,
  fetchDailyWorries,
  fetchWorries,
  fetchWorryStats,
  restoreWorry,
  updateWorryConclusion,
  updateWorryAttempt,
} from '../api/worries';

export function useWorries(date, calendarYear, calendarMonth) {
  const [active, setActive] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [daily, setDaily] = useState({ worries: [], stats: { attempted: 0, total: 0 } });
  const [monthStats, setMonthStats] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadList = useCallback(async () => {
    const data = await fetchWorries();
    setActive(data.active);
    setCompleted(data.completed);
    setLoaded(true);
  }, []);

  const loadDaily = useCallback(async () => {
    setDaily(await fetchDailyWorries(date));
  }, [date]);

  const loadStats = useCallback(async () => {
    const data = await fetchWorryStats(calendarYear, calendarMonth + 1);
    setMonthStats(data.stats);
  }, [calendarYear, calendarMonth]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDaily(); }, [loadDaily]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const addWorry = useCallback(async (title) => {
    await createWorry(title);
    await Promise.all([loadList(), loadDaily(), loadStats()]);
  }, [loadList, loadDaily, loadStats]);

  const markComplete = useCallback(async (id, conclusion) => {
    await completeWorry(id, conclusion);
    await Promise.all([loadList(), loadDaily(), loadStats()]);
  }, [loadList, loadDaily, loadStats]);

  const setAttempted = useCallback(async (id, attempted) => {
    await updateWorryAttempt(id, date, attempted);
    await Promise.all([loadDaily(), loadStats()]);
  }, [date, loadDaily, loadStats]);

  const editConclusion = useCallback(async (id, conclusion) => {
    const worry = await updateWorryConclusion(id, conclusion);
    await loadList();
    return worry;
  }, [loadList]);

  const restoreCompleted = useCallback(async (id) => {
    const worry = await restoreWorry(id);
    await Promise.all([loadList(), loadDaily(), loadStats()]);
    return worry;
  }, [loadList, loadDaily, loadStats]);

  return {
    active,
    completed,
    daily,
    monthStats,
    loaded,
    addWorry,
    markComplete,
    editConclusion,
    restoreCompleted,
    setAttempted,
  };
}
