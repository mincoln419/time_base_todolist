import { formatMinutes } from '../utils/time';

const HOUR_HEIGHT = 56; // px per hour
// 기본으로는 업무시간대(TimeGrid의 WORK_START_MIN/WORK_END_MIN)에 여유를 둔 08~19시만 보여줘
// 휠을 돌려 스크롤할 필요를 없앤다. 이 범위를 벗어난 일정이 있으면 그만큼만 자동으로 넓힌다.
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;

const STATUS_STYLE = {
  todo:        'bg-gray-100 border-gray-300 text-gray-700',
  in_progress: 'bg-blue-100 border-blue-400 text-blue-800',
  done:        'bg-green-100 border-green-400 text-green-800',
};

function visibleHourRange(schedules) {
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const s of schedules) {
    startHour = Math.min(startHour, Math.floor(s.start_min / 60));
    endHour = Math.max(endHour, Math.ceil(s.end_min / 60));
  }
  return { startHour: Math.max(startHour, 0), endHour: Math.min(endHour, 24) };
}

export default function DayTimeline({ schedules, date }) {
  const { startHour, endHour } = visibleHourRange(schedules);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const rangeStartMin = startHour * 60;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="font-semibold text-gray-700 text-sm">타임라인 — {date}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
          {/* Hour rows */}
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute w-full border-b border-gray-100"
              style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span className="absolute left-2 top-1 text-xs text-gray-400 select-none w-10">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {/* Schedule blocks */}
          {schedules.map((s) => {
            const durationMin = s.end_min - s.start_min;
            const statusClass = STATUS_STYLE[s.status] ?? STATUS_STYLE.todo;
            return (
              <div
                key={s.id}
                className={`absolute border rounded-md px-2 py-1 overflow-hidden ${statusClass}`}
                style={{
                  top: ((s.start_min - rangeStartMin) / 60) * HOUR_HEIGHT + 1,
                  height: (durationMin / 60) * HOUR_HEIGHT - 2,
                  left: '3.5rem',
                  right: '0.5rem',
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold leading-tight truncate">{s.title}</p>
                  <p className="text-xs opacity-60 flex-shrink-0 whitespace-nowrap">
                    {formatMinutes(s.start_min)} – {formatMinutes(s.end_min)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
