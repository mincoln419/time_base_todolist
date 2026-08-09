import { useAllTickets } from '../../hooks/useAllTickets';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export default function Calendar({ year, month, onMonthChange, onTicketOpen }) {
  const { tickets, loaded } = useAllTickets();
  const today = new Date();

  const moveMonth = (delta) => {
    const d = new Date(year, month + delta, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  if (!loaded) {
    return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
  }

  const byDate = {};
  for (const t of tickets) {
    if (!t.desired_date) continue;
    (byDate[t.desired_date] ??= []).push(t);
  }

  const days = buildGrid(year, month);
  const todayStr = toDateString(today);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-4 p-4 bg-white border-b flex-shrink-0">
        <button onClick={() => moveMonth(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">◀</button>
        <span className="text-lg font-semibold">{year}-{String(month + 1).padStart(2, '0')}</span>
        <button onClick={() => moveMonth(1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">▶</button>
        <span className="text-xs text-gray-400">티켓을 더블클릭하면 고객사 티켓 탭으로 이동합니다</span>
      </div>

      <div className="grid grid-cols-7 border-b flex-shrink-0">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={
              'p-2 text-center text-xs font-semibold border-r last:border-r-0 ' +
              (i === 0 || i === 6 ? 'text-red-500' : 'text-gray-500')
            }
          >
            {w}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0 overflow-y-auto">
        {days.map((d) => {
          const dStr = toDateString(d);
          const inMonth = d.getMonth() === month;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayTickets = byDate[dStr] ?? [];
          return (
            <div
              key={dStr}
              className={
                'border-b border-r p-1 min-h-[90px] flex flex-col gap-1 ' +
                (isWeekend ? 'bg-gray-50' : inMonth ? 'bg-white' : 'bg-gray-50')
              }
            >
              <span
                className={
                  'text-xs ' +
                  (dStr === todayStr
                    ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white'
                    : isWeekend
                      ? (inMonth ? 'text-red-500' : 'text-red-300')
                      : inMonth ? 'text-gray-700' : 'text-gray-300')
                }
              >
                {d.getDate()}
              </span>
              {dayTickets.map((t) => (
                <div
                  key={t.id}
                  onDoubleClick={() => onTicketOpen({ customerId: t.customer_id, ticketId: t.id })}
                  title="더블클릭하면 티켓 상세로 이동합니다"
                  className={
                    'text-[11px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate ' +
                    (t.registered ? 'line-through text-gray-400 bg-gray-100' : 'text-blue-700 bg-blue-50 hover:bg-blue-100')
                  }
                >
                  [{t.customer_name}] {t.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
