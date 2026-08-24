import { useMemo, useRef, useState } from 'react';
import { useWorries } from '../../hooks/useWorries';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_CONCLUSION_LENGTH = 2000;

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateLabel(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function addDays(dateString, amount) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + amount);
  return toDateString(d);
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

export default function UnconsciousWorries({ onFocusMap }) {
  const today = useMemo(() => toDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarYM, setCalendarYM] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [input, setInput] = useState('');
  const [detailWorry, setDetailWorry] = useState(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailDraft, setDetailDraft] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const touchStartX = useRef(null);

  const {
    active,
    completed,
    daily,
    monthStats,
    loaded,
    addWorry,
    markComplete,
    editConclusion,
    restoreCompleted,
    setAttempted,
  } = useWorries(selectedDate, calendarYM.year, calendarYM.month);

  const statsByDate = useMemo(() => {
    return Object.fromEntries(monthStats.map((stat) => [stat.date, stat]));
  }, [monthStats]);

  const submit = async (e) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    try {
      await addWorry(value);
      setInput('');
    } catch (err) {
      alert(err.message);
    }
  };

  const moveDate = (amount) => {
    const next = addDays(selectedDate, amount);
    const d = new Date(`${next}T00:00:00`);
    setSelectedDate(next);
    setCalendarYM({ year: d.getFullYear(), month: d.getMonth() });
  };

  const moveMonth = (amount) => {
    const d = new Date(calendarYM.year, calendarYM.month + amount, 1);
    setCalendarYM({ year: d.getFullYear(), month: d.getMonth() });
  };

  const selectDate = (date) => {
    const d = new Date(`${date}T00:00:00`);
    setSelectedDate(date);
    setCalendarYM({ year: d.getFullYear(), month: d.getMonth() });
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 48) return;
    moveDate(diff > 0 ? -1 : 1);
  };

  const calendarDays = buildGrid(calendarYM.year, calendarYM.month);
  const currentDetail = detailWorry
    ? [...active, ...completed].find((worry) => worry.id === detailWorry.id) ?? detailWorry
    : null;
  const detailIsCompleted = Boolean(currentDetail?.completed_at);

  const openDetail = (worry) => {
    setDetailWorry(worry);
    setDetailDraft(worry.conclusion ?? '');
    setDetailEditing(false);
  };

  const closeDetail = () => {
    setDetailWorry(null);
    setDetailDraft('');
    setDetailEditing(false);
  };

  const saveDetail = async () => {
    if (!currentDetail) return;
    try {
      const saved = await editConclusion(currentDetail.id, detailDraft);
      setDetailWorry(saved);
      setDetailDraft(saved.conclusion ?? '');
      setDetailEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const completeWorry = async (id, conclusion) => {
    try {
      await markComplete(id, conclusion);
    } catch (err) {
      alert(err.message);
    }
  };

  const restoreWorry = async (id) => {
    try {
      await restoreCompleted(id);
    } catch (err) {
      alert(err.message);
    }
  };

  const requestComplete = (worry) => {
    setConfirmState({
      message: '이 고민을 완료 처리할까요?',
      onConfirm: () => completeWorry(worry.id, worry.conclusion ?? ''),
    });
  };

  const requestRestore = (worry) => {
    setConfirmState({
      message: '완료된 고민을 다시 진행 중 목록으로 복원할까요?',
      onConfirm: () => restoreWorry(worry.id),
    });
  };

  if (!loaded) {
    return <div className="p-4 text-sm text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <section className="bg-white border rounded p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-gray-800">무의식 고민목록</h2>
            <span className="text-xs text-gray-500">진행 {active.length} / 완료 {completed.length}</span>
          </div>

          <form onSubmit={submit} className="flex gap-2 mb-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="고민할 내용을 입력"
              className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button type="submit" className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
              추가
            </button>
          </form>

          <div className="space-y-2">
            {active.map((worry) => (
              <div key={worry.id} className="flex items-center gap-2">
                <button
                  onClick={() => requestComplete(worry)}
                  title="완료"
                  className="shrink-0 w-11 h-11 rounded-full bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 flex items-center justify-center"
                >
                  완료
                </button>
                <div className="flex-1 flex items-start gap-3 p-2 rounded border bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 break-words">{worry.title}</p>
                  </div>
                  <button
                    onClick={() => openDetail(worry)}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-white border text-gray-700 hover:bg-gray-100"
                  >
                    상세
                  </button>
                </div>
              </div>
            ))}
            {active.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center border rounded border-dashed">
                기록된 고민이 없습니다.
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-4">
          <section
            className="bg-white border rounded p-4"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => moveDate(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                이전
              </button>
              <div className="flex-1 text-center">
                <div className="text-lg font-semibold text-gray-800">{selectedDate}</div>
                <div className="text-xs text-gray-400">해결 시도 {daily.stats.attempted}/{daily.stats.total}</div>
              </div>
              <button onClick={() => moveDate(1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                다음
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="w-16 p-2 border text-center">시도</th>
                    <th className="p-2 border text-left">고민</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.worries.map((worry) => (
                    <tr key={worry.id} className="hover:bg-blue-50/50">
                      <td className="p-2 border text-center">
                        <input
                          type="checkbox"
                          checked={worry.attempted === 1}
                          onChange={async (e) => {
                            try {
                              await setAttempted(worry.id, e.target.checked);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                          className="h-4 w-4 align-middle"
                        />
                      </td>
                      <td className="p-2 border text-gray-800">{worry.title}</td>
                    </tr>
                  ))}
                  {daily.worries.length === 0 && (
                    <tr>
                      <td colSpan="2" className="p-6 text-center text-sm text-gray-400">
                        이 날짜에 체크할 고민이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border rounded p-4">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => moveMonth(-1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                이전
              </button>
              <span className="flex-1 text-center text-lg font-semibold text-gray-800">
                {calendarYM.year}-{String(calendarYM.month + 1).padStart(2, '0')}
              </span>
              <button onClick={() => moveMonth(1)} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">
                다음
              </button>
            </div>

            <div className="grid grid-cols-7 border-t border-l">
              {WEEKDAYS.map((day, index) => (
                <div
                  key={day}
                  className={
                    'p-2 text-center text-xs font-semibold border-r border-b ' +
                    (index === 0 || index === 6 ? 'text-red-500' : 'text-gray-500')
                  }
                >
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const date = toDateString(day);
                const inMonth = day.getMonth() === calendarYM.month;
                const stat = statsByDate[date];
                const isSelected = date === selectedDate;
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => selectDate(date)}
                    className={
                      'min-h-[64px] p-1 border-r border-b text-left flex flex-col gap-1 hover:bg-blue-50 ' +
                      (inMonth ? 'bg-white' : 'bg-gray-50') +
                      (isSelected ? ' ring-2 ring-inset ring-blue-400' : '')
                    }
                  >
                    <span
                      className={
                        'text-xs inline-flex items-center justify-center w-5 h-5 rounded-full ' +
                        (isToday
                          ? 'bg-blue-500 text-white'
                          : inMonth
                            ? 'text-gray-700'
                            : 'text-gray-300')
                      }
                    >
                      {day.getDate()}
                    </span>
                    {stat?.total > 0 && (
                      <span className="self-start px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                        {stat.attempted}/{stat.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="bg-white border rounded p-4">
          <h2 className="font-semibold text-gray-800 mb-3">완료된 고민 목록</h2>
          <div className="space-y-2">
            {completed.map((worry) => (
              <div key={worry.id} className="flex items-center gap-2">
                <button
                  onClick={() => requestRestore(worry)}
                  title="복원"
                  className="shrink-0 w-11 h-11 rounded-full bg-white border text-emerald-600 text-[11px] font-semibold hover:bg-emerald-50 flex items-center justify-center"
                >
                  복원
                </button>
                <div className="flex-1 flex items-start gap-3 p-2 rounded border bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-500 line-through break-words">{worry.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{dateLabel(worry.created_at)}</p>
                  </div>
                  <button
                    onClick={() => openDetail(worry)}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-white border text-gray-700 hover:bg-gray-100"
                  >
                    상세
                  </button>
                </div>
              </div>
            ))}
            {completed.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center border rounded border-dashed">
                완료된 고민이 없습니다.
              </div>
            )}
          </div>
        </section>
      </div>

      {currentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded border bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b p-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 break-words">{currentDetail.title}</h3>
                <p className="mt-1 text-xs text-gray-400">
                  기록 {dateLabel(currentDetail.created_at)}
                  {currentDetail.completed_at ? ` / 완료 ${dateLabel(currentDetail.completed_at)}` : ''}
                </p>
              </div>
              <button
                onClick={() => onFocusMap?.(currentDetail)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-white border text-blue-600 hover:bg-blue-50"
              >
                포커스맵
              </button>
              <button
                onClick={closeDetail}
                className="px-2 py-1 text-sm rounded text-gray-500 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-sm font-semibold text-gray-700">결론</h4>
                {detailIsCompleted && !detailEditing && (
                  <button
                    onClick={() => {
                      setDetailDraft(currentDetail.conclusion ?? '');
                      setDetailEditing(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-500 text-white hover:bg-blue-600"
                  >
                    편집
                  </button>
                )}
              </div>

              {!detailIsCompleted ? (
                <>
                  <textarea
                    value={detailDraft}
                    onChange={(e) => setDetailDraft(e.target.value.slice(0, MAX_CONCLUSION_LENGTH))}
                    maxLength={MAX_CONCLUSION_LENGTH}
                    rows="10"
                    placeholder="생각을 정리하며 결론을 기록"
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                  />
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-gray-400">{detailDraft.length}/{MAX_CONCLUSION_LENGTH}</span>
                    <button
                      onClick={saveDetail}
                      className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                      저장
                    </button>
                  </div>
                </>
              ) : detailEditing ? (
                <>
                  <textarea
                    value={detailDraft}
                    onChange={(e) => setDetailDraft(e.target.value.slice(0, MAX_CONCLUSION_LENGTH))}
                    maxLength={MAX_CONCLUSION_LENGTH}
                    rows="10"
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-gray-400">{detailDraft.length}/{MAX_CONCLUSION_LENGTH}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setDetailDraft(currentDetail.conclusion ?? '');
                          setDetailEditing(false);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        취소
                      </button>
                      <button
                        onClick={saveDetail}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="min-h-[160px] rounded border bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {currentDetail.conclusion || '기록된 결론이 없습니다.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="w-full max-w-sm rounded border bg-white shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-800 mb-4">{confirmState.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmState(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                아니오
              </button>
              <button
                onClick={async () => {
                  const { onConfirm } = confirmState;
                  setConfirmState(null);
                  await onConfirm();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-500 text-white hover:bg-emerald-600"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
