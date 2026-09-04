import { useState, useEffect, useCallback } from 'react';
import { fetchSchedules } from '../api/schedules';

function weekDates(weekStartStr) {
  const start = new Date(weekStartStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// weekStart(일요일, "YYYY-MM-DD")가 속한 주의 7일치 스케줄을 병렬 조회한다.
// 신규 서버 API 없이 기존 fetchSchedules(date)를 재사용 — 개인 앱 규모라 7개 병렬 호출로 충분.
export function useWeekSchedules(weekStart) {
  const [schedulesByDate, setSchedulesByDate] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    const dates = weekDates(weekStart);
    const results = await Promise.allSettled(dates.map((d) => fetchSchedules(d)));
    const map = {};
    dates.forEach((d, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        map[d] = r.value;
      } else {
        map[d] = [];
        console.error(`주간 스케줄 조회 실패(${d}):`, r.reason);
      }
    });
    setSchedulesByDate(map);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  return { loading, schedulesByDate };
}
