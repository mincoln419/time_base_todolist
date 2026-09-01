import { useState } from 'react';
import { noteLabel, noteKeywords, renderNoteMarkdown } from './noteUtils';

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

export default function DailyNoteCalendarView({ notes, onCreateForDate, onEdit, onDelete }) {
  const today = new Date();
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(null);

  const moveMonth = (delta) => {
    const d = new Date(ym.year, ym.month + delta, 1);
    setYm({ year: d.getFullYear(), month: d.getMonth() });
  };

  const byDate = {};
  for (const note of notes) {
    (byDate[note.date] ??= []).push(note);
  }

  const days = buildGrid(ym.year, ym.month);
  const todayStr = toDateString(today);
  const selectedNotes = selectedDate ? byDate[selectedDate] ?? [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded bg-white overflow-hidden">
        <div className="flex items-center gap-4 p-3 border-b">
          <button onClick={() => moveMonth(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">◀</button>
          <span className="text-lg font-semibold">{ym.year}-{String(ym.month + 1).padStart(2, '0')}</span>
          <button onClick={() => moveMonth(1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">▶</button>
        </div>

        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={'p-2 text-center text-xs font-semibold border-r last:border-r-0 ' + (i === 0 || i === 6 ? 'text-red-500' : 'text-gray-500')}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d) => {
            const dateStr = toDateString(d);
            const inMonth = d.getMonth() === ym.month;
            const count = byDate[dateStr]?.length ?? 0;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={
                  'h-20 p-2 border-r border-b last:border-r-0 text-left align-top flex flex-col gap-1 ' +
                  (inMonth ? 'bg-white' : 'bg-gray-50 text-gray-300') +
                  (dateStr === selectedDate ? ' ring-2 ring-inset ring-blue-400' : '')
                }
              >
                <span className={dateStr === todayStr ? 'text-xs font-bold text-blue-600' : 'text-xs'}>
                  {d.getDate()}
                </span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 self-start">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="p-4 border rounded bg-white">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-gray-700">{selectedDate}</h4>
            <button
              onClick={() => onCreateForDate(selectedDate)}
              className="px-3 py-1 text-xs font-semibold rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              + 이 날짜에 작성
            </button>
          </div>

          {selectedNotes.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">이 날짜에 작성된 노트가 없습니다.</p>
          )}

          <div className="flex flex-col gap-3">
            {selectedNotes.map((note) => (
              <div key={note.id} className="p-3 border rounded">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {noteKeywords(note).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600">#{tag}</span>
                      ))}
                    </div>
                    <h5 className="font-semibold text-gray-800">{noteLabel(note)}</h5>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => onEdit(note)} className="text-xs text-gray-500 hover:text-blue-600">수정</button>
                    <button onClick={() => onDelete(note.id)} className="text-xs text-gray-500 hover:text-red-500">삭제</button>
                  </div>
                </div>
                {note.content && (
                  <div
                    className="mt-1 text-sm text-gray-700 markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(note.content) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
