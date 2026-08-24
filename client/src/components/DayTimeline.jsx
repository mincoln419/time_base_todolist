import { formatMinutes } from '../utils/time';

const HOUR_HEIGHT = 56; // px per hour — 24h × 56 = 1344px total
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const STATUS_STYLE = {
  todo:        'bg-gray-100 border-gray-300 text-gray-700',
  in_progress: 'bg-blue-100 border-blue-400 text-blue-800',
  done:        'bg-green-100 border-green-400 text-green-800',
};

export default function DayTimeline({ schedules, date }) {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="font-semibold text-gray-700 text-sm">타임라인 — {date}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Hour rows */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute w-full border-b border-gray-100"
              style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
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
                  top: (s.start_min / 60) * HOUR_HEIGHT + 1,
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
