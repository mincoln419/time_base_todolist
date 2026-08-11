import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DateNavigator from './components/DateNavigator';
import TaskBacklog from './components/TaskBacklog/TaskBacklog';
import TimeGrid from './components/TimeGrid/TimeGrid';
import DayTimeline from './components/DayTimeline';
import FocusMap from './components/FocusMap/FocusMap';
import CustomerTickets from './components/CustomerTickets/CustomerTickets';
import Calendar from './components/Calendar/Calendar';
import { useTasks } from './hooks/useTasks';
import { useSchedules } from './hooks/useSchedules';

const TABS = [
  { id: 'schedule', label: '일정관리' },
  { id: 'focusmap', label: '포커스 맵' },
  { id: 'customers', label: '고객사 티켓' },
  { id: 'calendar', label: '캘린더' },
];

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [tab, setTab] = useState('schedule');
  const [date, setDate] = useState(toDateString(new Date()));
  const [activeItem, setActiveItem] = useState(null); // DragOverlay용
  const [ticketFocus, setTicketFocus] = useState(null); // 캘린더 더블클릭 → 고객사 티켓 탭 딥링크
  const [calendarYM, setCalendarYM] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }); // 탭을 벗어났다 돌아와도 보던 달을 유지하기 위해 App으로 끌어올린 상태

  const { tasks, addTask, removeTask } = useTasks();
  const { schedules, addSchedule, changeStatus, changeTime, removeSchedule } = useSchedules(date);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // 탭 전환마다 History 엔트리를 쌓아, 브라우저 뒤로가기로 이전 탭으로 돌아갈 수 있게 한다
  useEffect(() => {
    window.history.replaceState({ tab: 'schedule' }, '');
    const onPopState = (e) => setTab(e.state?.tab ?? 'schedule');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const goToTab = (nextTab) => {
    if (nextTab === tab) return;
    window.history.pushState({ tab: nextTab }, '');
    setTab(nextTab);
  };

  const handleDragStart = ({ active }) => setActiveItem(active.data.current);

  const handleDragEnd = async ({ active, over }) => {
    setActiveItem(null);
    if (!over) return;

    const src = active.data.current;
    const dst = over.data.current ?? { type: over.id === 'backlog' ? 'backlog' : null };

    // 백로그 → 시간 슬롯
    if (src.type === 'task' && (dst.type === 'slot' || dst.type === 'timeblock')) {
      const startHour = dst.type === 'slot' ? dst.hour : schedules.find((s) => s.id === dst.blockId)?.start_hour;
      if (startHour == null) return;
      try {
        await addSchedule({ title: src.title, start_hour: startHour, end_hour: startHour + 1 });
      } catch (e) {
        alert(e.message);
      }
    }

    // 시간 블록 → 백로그 (복귀)
    if (src.type === 'schedule' && dst.type === 'backlog') {
      await removeSchedule(src.scheduleId);
    }
  };

  // 수기 시간 블록 추가 (DnD 없이) — 첫 번째 미배치 할일 제목으로 생성
  const handleAddBlock = async (startHour) => {
    if (tasks.length === 0) { alert('먼저 할 일을 추가해주세요.'); return; }
    const scheduledTitles = new Set(schedules.map((s) => s.title));
    const target = tasks.find((t) => !scheduledTitles.has(t.title)) ?? tasks[0];
    try {
      await addSchedule({ title: target.title, start_hour: startHour, end_hour: startHour + 1 });
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <nav className="flex items-center gap-2 p-4 bg-white border-b flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goToTab(t.id)}
            className={
              'px-3 py-1 text-sm font-semibold rounded transition-colors ' +
              (tab === t.id
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'schedule' && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* 좌측 절반 — 기존 컨트롤 패널 */}
            <div className="w-1/2 flex flex-col min-h-0">
              <DateNavigator date={date} onChange={setDate} />
              <TaskBacklog
                tasks={tasks}
                onAdd={addTask}
                onDelete={async (id) => { await removeTask(id); }}
              />
              <TimeGrid
                schedules={schedules}
                onStatusChange={changeStatus}
                onTimeChange={changeTime}
                onRemove={removeSchedule}
                onAddBlock={handleAddBlock}
              />
            </div>

            {/* 우측 절반 — 24시간 타임라인 시각화 */}
            <div className="w-1/2 flex flex-col min-h-0">
              <DayTimeline schedules={schedules} date={date} />
            </div>
          </div>

          <DragOverlay>
            {activeItem ? (
              <div className="px-3 py-2 bg-blue-100 border border-blue-300 rounded shadow-lg text-sm">
                {activeItem.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {tab === 'focusmap' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Design Ref: §11.2 — addTask를 prop으로 전달해 App의 useTasks 상태와 공유(별도 useTasks 호출 시 탭 전환 후 스테일 상태 방지) */}
          <FocusMap addTask={addTask} />
        </div>
      )}

      {tab === 'customers' && (
        <CustomerTickets
          onTaskAdd={addTask}
          focusTicket={ticketFocus}
          onFocusHandled={() => setTicketFocus(null)}
        />
      )}

      {tab === 'calendar' && (
        <Calendar
          year={calendarYM.year}
          month={calendarYM.month}
          onMonthChange={(year, month) => setCalendarYM({ year, month })}
          onTicketOpen={(focus) => {
            setTicketFocus(focus);
            goToTab('customers');
          }}
        />
      )}
    </div>
  );
}
