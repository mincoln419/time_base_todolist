import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules';
import { notifyWorkStart } from '../api/notify';

const AUTO_PROGRESS_INTERVAL_MS = 30 * 60 * 1000; // 30분마다 시작 시간이 지난 '예정' 일정을 점검

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function useSchedules(date) {
  const [schedules, setSchedules] = useState([]);
  const schedulesRef = useRef(schedules);
  useEffect(() => { schedulesRef.current = schedules; }, [schedules]);

  const load = useCallback(async () => {
    if (!date) return;
    setSchedules(await fetchSchedules(date));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // 오늘 일자 화면에 한해 30분마다 시작 시간이 지난 '예정(planned)' 일정을 '진행중'으로 일괄 전환 — 완료는 항상 수동
  useEffect(() => {
    if (date !== todayString()) return;

    const checkAndAdvance = async () => {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const toAdvance = schedulesRef.current.filter((s) => s.status === 'planned' && s.start_min <= currentMin);
      if (toAdvance.length === 0) return;

      // expectedStatus로 요청을 보내는 사이 사용자가 상태를 바꿨다면 서버가 그 값을 그대로 돌려주므로, 응답을 그대로 신뢰한다
      const updated = await Promise.all(
        toAdvance.map((s) => updateSchedule(s.id, { status: 'in_progress', expectedStatus: 'planned' }))
      );
      const updatedById = new Map(updated.map((s) => [s.id, s]));
      setSchedules((prev) => prev.map((s) => updatedById.get(s.id) ?? s));

      updated
        .filter((s) => s.status === 'in_progress')
        .forEach((s) => { notifyWorkStart(s.title).catch((e) => console.error('알림 전송 실패:', e.message)); });
    };

    checkAndAdvance();
    const timer = setInterval(checkAndAdvance, AUTO_PROGRESS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [date]);

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
