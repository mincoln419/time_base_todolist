import { useState } from 'react';
import { useWeekSchedules } from '../hooks/useWeekSchedules';
import { formatMinutes } from '../utils/time';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_HOUR_HEIGHT = 32; // px per hour — DayTimeline(56)보다 작게 잡아 7컬럼에서도 한눈에 들어오게 함
// DayTimeline.jsx와 동일하게 기본 08~19시만 보여주고, 그 범위를 벗어난 일정이 있으면 자동 확장
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;

// DayTimeline.jsx의 STATUS_STYLE과 동일한 값 — 공용 유틸 추출 없이 로컬 복제하는 기존 관례를 따름
const STATUS_STYLE = {
  todo:        'bg-gray-100 border-gray-300 text-gray-700',
  in_progress: 'bg-blue-100 border-blue-400 text-blue-800',
  done:        'bg-green-100 border-green-400 text-green-800',
};

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = 일요일
  return toDateString(d);
}

function weekDates(weekStartStr) {
  const start = new Date(weekStartStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toDateString(d);
  });
}

function visibleHourRange(schedulesByDate) {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const list of Object.values(schedulesByDate)) {
    for (const s of list) {
      startHour = Math.min(startHour, Math.floor(s.start_min / 60));
      endHour = Math.max(endHour, Math.ceil(s.end_min / 60));
    }
  }
  return { startHour: Math.max(startHour, 0), endHour: Math.min(endHour, 24) };
}

export default function WeekTimeline({ onSelectDate }) {
  const todayStr = toDateString(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayStr));
  const { loading, schedulesByDate } = useWeekSchedules(weekStart);

  const dates = weekDates(weekStart);
  const weekEnd = dates[6];
  const { startHour, endHour } = visibleHourRange(schedulesByDate);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const rangeStartMin = startHour * 60;

  const moveWeek = (deltaWeeks) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(toDateString(d));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => moveWeek(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">◀</button>
        <span className="text-sm font-semibold text-gray-700">{weekStart} ~ {weekEnd}</span>
        <button onClick={() => moveWeek(1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">▶</button>
        <button
          onClick={() => setWeekStart(startOfWeek(todayStr))}
          className="ml-1 px-3 py-1 text-sm font-semibold rounded bg-blue-500 text-white hover:bg-blue-600"
        >
          이번 주
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border rounded bg-white">
        {/* 요일 헤더 — 클릭 시 해당 날짜의 일간 뷰로 이동 */}
        <div className="flex border-b sticky top-0 bg-white z-10">
          <div className="w-10 flex-shrink-0" />
          {dates.map((date, i) => {
            const isToday = date === todayStr;
            const [, m, d] = date.split('-');
            return (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={
                  'flex-1 p-2 text-center border-l hover:bg-gray-50 cursor-pointer ' +
                  (isToday ? 'bg-blue-50' : '')
                }
              >
                <div className={'text-xs font-semibold ' + (i === 0 || i === 6 ? 'text-red-500' : 'text-gray-500')}>
                  {WEEKDAYS[i]}
                </div>
                <div className={isToday ? 'text-xs font-bold text-blue-600' : 'text-xs text-gray-600'}>
                  {m}/{d}
                </div>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-8 text-center">불러오는 중...</p>
        ) : (
          <div className="flex relative" style={{ height: hours.length * WEEK_HOUR_HEIGHT }}>
            <div className="w-10 flex-shrink-0 relative">
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute left-1 text-[10px] text-gray-400 select-none"
                  style={{ top: i * WEEK_HOUR_HEIGHT - 5 }}
                >
                  {String(h).padStart(2, '0')}
                </span>
              ))}
            </div>

            {dates.map((date) => {
              const isToday = date === todayStr;
              return (
                <div key={date} className={'flex-1 relative border-l ' + (isToday ? 'bg-blue-50/40' : '')}>
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute w-full border-b border-gray-100"
                      style={{ top: i * WEEK_HOUR_HEIGHT, height: WEEK_HOUR_HEIGHT }}
                    />
                  ))}
                  {(schedulesByDate[date] ?? []).map((s) => {
                    const durationMin = s.end_min - s.start_min;
                    const statusClass = STATUS_STYLE[s.status] ?? STATUS_STYLE.todo;
                    return (
                      <div
                        key={s.id}
                        title={`${s.title} (${formatMinutes(s.start_min)}–${formatMinutes(s.end_min)})`}
                        className={`absolute border rounded px-1 overflow-hidden ${statusClass}`}
                        style={{
                          top: ((s.start_min - rangeStartMin) / 60) * WEEK_HOUR_HEIGHT + 1,
                          height: Math.max((durationMin / 60) * WEEK_HOUR_HEIGHT - 2, 10),
                          left: 2,
                          right: 2,
                        }}
                      >
                        <p className="text-[10px] font-semibold leading-tight truncate">{s.title}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
