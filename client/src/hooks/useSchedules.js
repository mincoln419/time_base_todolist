import { useState, useEffect, useCallback } from 'react';
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules';

const REFRESH_INTERVAL_MS = 60 * 1000; // 서버가 자동전환한 상태를 반영하기 위해 1분마다 재조회

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function useSchedules(date) {
  const [schedules, setSchedules] = useState([]);

  const load = useCallback(async () => {
    if (!date) return;
    setSchedules(await fetchSchedules(date));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // '예정 → 진행중' 자동전환과 알림 전송은 서버(scheduler.js)가 수행 — 여기서는 오늘 일자 화면만 주기적으로 재조회해 반영한다
  useEffect(() => {
    if (date !== todayString()) return;
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [date, load]);

  const addSchedule = useCallback(async ({ title, start_min, end_min }) => {
    const s = await createSchedule({ title, date, start_min, end_min });
    setSchedules((prev) => [...prev, s].sort((a, b) => a.start_min - b.start_min));
    return s;
  }, [date]);

  const changeTitle = useCallback(async (id, title) => {
    const s = await updateSchedule(id, { title });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)));
  }, []);

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

  return { schedules, addSchedule, changeTitle, changeStatus, changeTime, removeSchedule };
}
