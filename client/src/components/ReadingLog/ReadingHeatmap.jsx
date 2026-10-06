import { useMemo } from 'react';
import { addDays, dailyAchievement, parseDate } from '../../utils/readingCalc';

const DAY_LABELS = ['', '월', '', '수', '', '금', ''];
// 계획 대비 수행률 → 색 단계 (시각화 구간, 100% = 그날 목표 달성)
const LEVELS = [
  { min: 1.5, className: 'bg-emerald-700', label: '150% 이상' },
  { min: 1, className: 'bg-emerald-500', label: '100% 이상 (달성)' },
  { min: 0.5, className: 'bg-emerald-300', label: '50~99%' },
  { min: Number.MIN_VALUE, className: 'bg-emerald-100', label: '50% 미만' },
];
const EMPTY = { className: 'bg-gray-100', label: '0% 또는 계획 없음' };

function levelOf(rate) {
  return (rate && LEVELS.find((level) => rate >= level.min)) || EMPTY;
}

function tooltip(date, entry, achievement) {
  const head = achievement.target > 0
    ? `${date} · ${achievement.read}p / 목표 ${achievement.target}p (${Math.round(achievement.rate * 100)}%)`
    : `${date} · 계획 없음`;
  if (!entry) return head;
  const detail = entry.items
    .map((item) => `${item.title} ${item.pages}p${item.belowTarget ? `(목표 ${item.target}p 미달)` : ''}`)
    .join(', ');
  return `${head}\n${detail}`;
}

function streak(totals, today) {
  let day = totals.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (totals.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export default function ReadingHeatmap({ books, totals, today, selectedDate, onSelectDate, weekCount }) {
  // 이번 주 토요일에서 끝나는 weekCount주(독서기록 설정), 일요일 시작 열
  const weeks = useMemo(() => {
    const end = addDays(today, 6 - parseDate(today).getDay());
    const start = addDays(end, -(weekCount * 7 - 1));
    return Array.from({ length: weekCount }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d))
    );
  }, [today, weekCount]);

  const monthPrefix = today.slice(0, 7);
  const readDays = [...totals.keys()];
  const summary = {
    total: readDays.length,
    month: readDays.filter((date) => date.startsWith(monthPrefix)).length,
    streak: streak(totals, today),
  };

  return (
    <section className="bg-white border rounded p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-semibold text-gray-800">독서 잔디</h2>
        <div className="text-xs text-gray-500">
          총 {summary.total}일 읽음 · 이번 달 {summary.month}일 · 연속 {summary.streak}일
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-flex gap-[3px]">
          <div className="flex flex-col gap-[3px] pt-4 pr-1">
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="h-3 text-[10px] leading-3 text-gray-400">{label}</div>
            ))}
          </div>
          {weeks.map((days) => {
            // 1일이 포함된 주 열 위에만 월 라벨 — 라벨끼리 겹치지 않도록 첫 열 강제 표시는 하지 않음
            const firstOfMonth = days.find((date) => date.endsWith('-01'));
            return (
              <div key={days[0]} className="flex flex-col gap-[3px]">
                <div className="h-4 text-[10px] leading-4 text-gray-400 whitespace-nowrap">
                  {firstOfMonth ? `${Number(firstOfMonth.slice(5, 7))}월` : ''}
                </div>
                {days.map((date) => {
                  if (date > today) return <div key={date} className="w-3 h-3" />;
                  const entry = totals.get(date);
                  const achievement = dailyAchievement(books, date);
                  return (
                    <button
                      key={date}
                      type="button"
                      title={tooltip(date, entry, achievement)}
                      onClick={() => onSelectDate(date)}
                      className={
                        'w-3 h-3 rounded-sm ' + levelOf(achievement.rate).className +
                        (date === selectedDate ? ' ring-2 ring-blue-400' : '')
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-gray-400">
        <span>계획 대비</span>
        {[EMPTY, ...[...LEVELS].reverse()].map((level) => (
          <span key={level.className} title={level.label} className={'w-3 h-3 rounded-sm ' + level.className} />
        ))}
        <span>150%+</span>
      </div>
    </section>
  );
}
