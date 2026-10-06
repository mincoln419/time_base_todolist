import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from '../api/schedules';

// 로컬 기준 오늘 (toISOString은 UTC라 한국 시간 오전 9시 전에는 어제가 된다)
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function useSchedules(date) {
  const [schedules, setSchedules] = useState([]);
  const [wake, setWake] = useState(0); // 다음 일정 시작 시각에 효과를 다시 돌리기 위한 카운터
  const advancingRef = useRef(new Set()); // '진행중'으로 바꾸는 요청이 진행 중인 일정 id

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

  const changeTitle = useCallback(async (id, title) => {
    const s = await updateSchedule(id, { title });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)));
  }, []);

  const changeStatus = useCallback(async (id, status) => {
    const s = await updateSchedule(id, { status });
    setSchedules((prev) => prev.map((x) => (x.id === id ? s : x)));
  }, []);

  // 오늘 화면에서 시작 시간이 지난 '예정' 일정을 '진행중'으로 바꾼다.
  // 서버를 주기적으로 조회하지 않는다 — 화면을 열 때 지난 일정을 한 번에 바꾸고, 그다음엔
  // 다음 '예정' 일정의 시작 시각에만 타이머가 깨어나 그 일정만 갱신한다(쓰기만, 읽기 없음).
  useEffect(() => {
    if (date !== localToday()) return undefined;
    const now = nowMinutes();
    for (const s of schedules) {
      if (s.status !== 'planned' || s.start_min > now || advancingRef.current.has(s.id)) continue;
      advancingRef.current.add(s.id);
      changeStatus(s.id, 'in_progress')
        .catch(() => {})
        .finally(() => advancingRef.current.delete(s.id));
    }

    const upcoming = schedules.filter((s) => s.status === 'planned' && s.start_min > now).map((s) => s.start_min);
    if (upcoming.length === 0) return undefined;
    const next = Math.min(...upcoming);
    const d = new Date();
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(next / 60), next % 60);
    // 분이 바뀐 직후에 깨어나도록 약간의 여유를 둔다
    const timer = setTimeout(() => setWake((w) => w + 1), at - d + 1000);
    return () => clearTimeout(timer);
  }, [date, schedules, wake, changeStatus]);

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
