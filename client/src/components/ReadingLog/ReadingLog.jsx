import { useEffect, useMemo, useState } from 'react';
import { useReading } from '../../hooks/useReading';
import ReadingHeatmap from './ReadingHeatmap';
import {
  DAILY_TARGET,
  addDays,
  bookEta,
  bookStatus,
  currentPage,
  dailyTotals,
  daysBetween,
  daysLeft,
  estimateFinish,
  logOn,
  missedDays,
  pageBefore,
  todayString,
} from '../../utils/readingCalc';

const INPUT = 'px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300';
const PAGE_INPUT = 'w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300';

function createEmptyBookForm(today) {
  return { title: '', start_date: today, start_page: '0', total_pages: '' };
}

function toBookForm(book) {
  return {
    title: book.title,
    start_date: book.start_date,
    start_page: String(book.start_page),
    total_pages: String(book.total_pages),
  };
}

function toPayload(form) {
  return {
    title: form.title,
    start_date: form.start_date,
    start_page: Number(form.start_page || 0),
    total_pages: Number(form.total_pages),
  };
}

function percent(book) {
  return Math.round((currentPage(book) / book.total_pages) * 100);
}

// 날짜가 바뀌어도(자정을 넘겨 켜둔 경우) 체크리스트가 새 날짜로 갱신되도록 1분마다 확인
function useToday() {
  const [today, setToday] = useState(todayString);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayString()), 60000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

function BookFields({ form, setForm }) {
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  return (
    <>
      <input value={form.title} onChange={set('title')} placeholder="책 제목" className={'w-full ' + INPUT} />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-gray-500">
          시작일
          <input type="date" value={form.start_date} onChange={set('start_date')} className={'mt-1 w-full ' + INPUT} />
        </label>
        <label className="text-xs text-gray-500">
          현재 페이지
          <input type="number" min="0" value={form.start_page} onChange={set('start_page')} className={'mt-1 w-full ' + INPUT} />
        </label>
        <label className="text-xs text-gray-500">
          총 페이지
          <input type="number" min="1" value={form.total_pages} onChange={set('total_pages')} className={'mt-1 w-full ' + INPUT} />
        </label>
      </div>
    </>
  );
}

function BookPreview({ form, today }) {
  const total = Number(form.total_pages);
  const current = Number(form.start_page || 0);
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(current) || current < 0 || current > total) {
    return null;
  }
  const left = daysLeft(total, current);
  const eta = estimateFinish({ total, current, startDate: form.start_date || today, readToday: false }, today);
  return (
    <div className="text-xs text-blue-600">
      하루 {DAILY_TARGET}p 기준 약 {left}일 소요{eta ? ` · 예상 완독 ${eta}` : ' · 이미 완독'}
    </div>
  );
}

function ChecklistRow({ book, date, onCheck, onUncheck }) {
  const log = logOn(book, date);
  const before = pageBefore(book, date);
  const defaultPage = Math.min(before + DAILY_TARGET, book.total_pages);
  const [page, setPage] = useState(String(log?.page_to ?? defaultPage));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setPage(String(log?.page_to ?? defaultPage));
    setEditing(false);
  }, [log?.page_to, defaultPage, date]);

  const save = async () => {
    try {
      await onCheck(book.id, date, Number(page));
      setEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggle = async (e) => {
    try {
      if (e.target.checked) await onCheck(book.id, date, Number(page));
      else await onUncheck(book.id, date);
    } catch (err) {
      alert(err.message);
    }
  };

  const read = log ? log.page_to - before : 0;

  return (
    <div className={'flex items-center gap-2 p-2 rounded border ' + (log ? 'bg-emerald-50' : 'bg-gray-50')}>
      <input type="checkbox" checked={!!log} onChange={toggle} className="h-4 w-4" />
      <div className="min-w-0 flex-1">
        <div className={'text-sm break-words ' + (log ? 'text-gray-500' : 'text-gray-800')}>{book.title}</div>
        <div className="text-xs text-gray-400">{currentPage(book)} / {book.total_pages}p</div>
      </div>
      {log && !editing ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            title="도달 페이지 수정"
            className="text-sm text-gray-700 hover:text-blue-600"
          >
            {before} → {log.page_to}p <span className="text-emerald-600">(+{read})</span>
          </button>
          {read < DAILY_TARGET && (
            <span className="px-1.5 py-0.5 text-[11px] rounded bg-amber-100 text-amber-700">목표 미달</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">{before} →</span>
          <input
            type="number"
            min={before + 1}
            max={book.total_pages}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className={PAGE_INPUT}
          />
          <button onClick={save} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600">
            {log ? '저장' : '체크'}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
              취소
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BookRow({ book, today, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toBookForm(book));
  const status = bookStatus(book, today);
  const missed = status === 'reading' ? missedDays(book, today) : 0;
  const eta = bookEta(book, today);

  const save = async () => {
    try {
      await onSave(book.id, toPayload(form));
      setEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  if (editing) {
    return (
      <div className="p-2 rounded border bg-blue-50 space-y-2">
        <BookFields form={form} setForm={setForm} />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={!form.title.trim()}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            저장
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 rounded border bg-gray-50">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {status === 'planned' && (
              <span className="px-2 py-0.5 text-[11px] rounded bg-white border text-gray-500">예정</span>
            )}
            <span className="text-sm font-semibold text-gray-800 break-words">{book.title}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-gray-200 overflow-hidden">
            <div
              className={'h-full ' + (status === 'done' ? 'bg-emerald-400' : 'bg-blue-400')}
              style={{ width: `${percent(book)}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {currentPage(book)} / {book.total_pages}p ({percent(book)}%)
            {status === 'done' && ` · ${book.start_date} ~ ${book.finished_at} (${daysBetween(book.start_date, book.finished_at) + 1}일)`}
            {status === 'planned' && ` · ${book.start_date} 시작`}
            {status !== 'done' && ` · ${daysLeft(book.total_pages, currentPage(book))}일 남음`}
            {eta && ` · 예상 ${eta}`}
            {missed > 0 && <span className="text-gray-400"> · 놓친 날 {missed}일</span>}
          </div>
        </div>
        <button
          onClick={() => { setForm(toBookForm(book)); setEditing(true); }}
          title="수정"
          className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          onClick={async () => {
            try {
              await onRemove(book.id);
            } catch (err) {
              alert(err.message);
            }
          }}
          className="px-2 py-1 text-xs rounded text-red-500 hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

export default function ReadingLog() {
  const { books, loaded, addBook, updateBook, removeBook, checkLog, uncheckLog } = useReading();
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [bookForm, setBookForm] = useState(() => createEmptyBookForm(today));

  // 자정이 지나면 선택 날짜도 새 오늘로 넘어간다(지난 날짜를 보고 있던 경우는 유지)
  useEffect(() => {
    setSelectedDate((prev) => (prev === addDays(today, -1) ? today : prev));
  }, [today]);

  const totals = useMemo(() => dailyTotals(books), [books]);

  const checklist = books.filter((book) =>
    book.start_date <= selectedDate && (!book.finished_at || book.finished_at >= selectedDate)
  );
  const remaining = books
    .filter((book) => bookStatus(book, today) !== 'done')
    .sort((a, b) => {
      const sa = bookStatus(a, today);
      const sb = bookStatus(b, today);
      if (sa !== sb) return sa === 'reading' ? -1 : 1;
      if (sa === 'planned') return a.start_date.localeCompare(b.start_date);
      return daysLeft(a.total_pages, currentPage(a)) - daysLeft(b.total_pages, currentPage(b));
    });
  const finished = books
    .filter((book) => bookStatus(book, today) === 'done')
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at));

  const moveDate = (days) => {
    const next = addDays(selectedDate, days);
    setSelectedDate(next > today ? today : next);
  };

  const submitBook = async (e) => {
    e.preventDefault();
    try {
      await addBook(toPayload(bookForm));
      setBookForm(createEmptyBookForm(today));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!loaded) {
    return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <ReadingHeatmap totals={totals} today={today} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
          <section className="bg-white border rounded p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-gray-800">
                {selectedDate === today ? '오늘의 독서' : '독서 체크'}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => moveDate(-1)} className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200">◀</button>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value > today ? today : e.target.value)}
                  className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={() => moveDate(1)}
                  disabled={selectedDate >= today}
                  className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                >
                  ▶
                </button>
                {selectedDate !== today && (
                  <button onClick={() => setSelectedDate(today)} className="px-2 py-1 text-xs rounded text-blue-600 hover:bg-blue-50">
                    오늘
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {checklist.length === 0 ? (
                <div className="p-4 text-sm text-gray-400 text-center border rounded border-dashed">
                  이 날짜에 읽는 중인 책이 없습니다.
                </div>
              ) : (
                checklist.map((book) => (
                  <ChecklistRow key={book.id} book={book} date={selectedDate} onCheck={checkLog} onUncheck={uncheckLog} />
                ))
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="bg-white border rounded p-4">
              <h2 className="font-semibold text-gray-800 mb-3">책 추가</h2>
              <form onSubmit={submitBook} className="space-y-2">
                <BookFields form={bookForm} setForm={setBookForm} />
                <div className="flex items-center justify-between gap-2">
                  <BookPreview form={bookForm} today={today} />
                  <button type="submit" className="ml-auto px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    추가
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-white border rounded p-4">
              <h2 className="font-semibold text-gray-800 mb-3">남은 책 ({remaining.length})</h2>
              <div className="space-y-2">
                {remaining.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center border rounded border-dashed">
                    읽는 중이거나 읽을 예정인 책이 없습니다.
                  </div>
                ) : (
                  remaining.map((book) => (
                    <BookRow key={book.id} book={book} today={today} onSave={updateBook} onRemove={removeBook} />
                  ))
                )}
              </div>
            </section>

            <details className="bg-white border rounded p-4">
              <summary className="font-semibold text-gray-800 cursor-pointer">완독 ({finished.length})</summary>
              <div className="mt-3 space-y-2">
                {finished.map((book) => (
                  <BookRow key={book.id} book={book} today={today} onSave={updateBook} onRemove={removeBook} />
                ))}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </div>
  );
}
