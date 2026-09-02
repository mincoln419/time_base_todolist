import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DateNavigator from './components/DateNavigator';
import TaskBacklog from './components/TaskBacklog/TaskBacklog';
import TimeGrid from './components/TimeGrid/TimeGrid';
import DayTimeline from './components/DayTimeline';
import FocusMap from './components/FocusMap/FocusMap';
import CustomerTickets from './components/CustomerTickets/CustomerTickets';
import Calendar from './components/Calendar/Calendar';
import BackupControls from './components/BackupControls';
import UnconsciousWorries from './components/UnconsciousWorries/UnconsciousWorries';
import WebhookSettings from './components/Settings/WebhookSettings';
import LongGoals from './components/LongGoals/LongGoals';
import WarRoomBoard from './components/WarRoomBoard/WarRoomBoard';
import DailyNote from './components/DailyNote/DailyNote';
import MeetingMinutes from './components/MeetingMinutes/MeetingMinutes';

import { useTasks } from './hooks/useTasks';
import { useSchedules } from './hooks/useSchedules';

const TABS = [
  { id: 'schedule', label: '일정관리' },
  { id: 'focusmap', label: '포커스 맵' },
  { id: 'customers', label: '고객사 티켓' },
  { id: 'calendar', label: '캘린더' },
  { id: 'worries', label: '무의식 고민목록' },
  { id: 'settings', label: '설정' },
  { id: 'longgoals', label: '장기목표' },
  { id: 'warroom', label: '업무 배치 보드' },
  { id: 'dailynote', label: '데일리노트' },
  { id: 'meetings', label: '회의록' },
];

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_DURATION_MIN = 60; // 새 블록의 기본 길이 — 1시간
const MIN_DURATION_STEP = 30; // 남은 시간이 부족할 때 낮출 단위
const DAY_END_MIN = 24 * 60;

export default function App() {
  const [tab, setTab] = useState('schedule');
  const [date, setDate] = useState(toDateString(new Date()));
  const [activeItem, setActiveItem] = useState(null); // DragOverlay용
  const [ticketFocus, setTicketFocus] = useState(null); // 캘린더 더블클릭 → 고객사 티켓 탭 딥링크
  const [focusMapSeed, setFocusMapSeed] = useState(null); // 무의식 고민 상세 → 포커스맵 목표 초안
  const [calendarYM, setCalendarYM] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }); // 탭을 벗어났다 돌아와도 보던 달을 유지하기 위해 App으로 끌어올린 상태

  const { tasks, addTask, removeTask } = useTasks();
  const { schedules, addSchedule, changeTitle, changeStatus, changeTime, removeSchedule } = useSchedules(date);

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

  // 데이터 폴링과 별개로, 탭을 오래 켜둬도 최신 빌드/상태를 반영하도록 30분마다 전체 새로고침
  useEffect(() => {
    const timer = setInterval(() => window.location.reload(), 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // 드롭 지점부터 다음 일정(또는 하루 끝)까지 남은 시간에 맞춰 기본 길이를 정한다 — 60분이 다 안 남으면 30분 단위로 축소
  const getDefaultDuration = (startMin) => {
    const nextStart = schedules
      .map((s) => s.start_min)
      .filter((m) => m > startMin)
      .reduce((min, m) => Math.min(min, m), DAY_END_MIN);
    const room = nextStart - startMin;
    if (room >= DEFAULT_DURATION_MIN) return DEFAULT_DURATION_MIN;
    return Math.max(MIN_DURATION_STEP, Math.floor(room / MIN_DURATION_STEP) * MIN_DURATION_STEP);
  };

  const handleDragStart = ({ active }) => setActiveItem(active.data.current);
  const currentTab = TABS.find((t) => t.id === tab) ?? { id: 'full', label: '전체' };
  const backupScope = currentTab.id === 'settings' ? { id: 'full', label: '전체' } : currentTab;

  const handleDragEnd = async ({ active, over }) => {
    setActiveItem(null);
    if (!over) return;

    const src = active.data.current;
    const dst = over.data.current ?? { type: over.id === 'backlog' ? 'backlog' : null };

    // 백로그 → 시간 슬롯
    if (src.type === 'task' && (dst.type === 'slot' || dst.type === 'timeblock')) {
      const startMin = dst.type === 'slot' ? dst.startMin : schedules.find((s) => s.id === dst.blockId)?.start_min;
      if (startMin == null) return;
      try {
        await addSchedule({ title: src.title, start_min: startMin, end_min: startMin + getDefaultDuration(startMin) });
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
  const handleAddBlock = async (startMin) => {
    if (tasks.length === 0) { alert('먼저 할 일을 추가해주세요.'); return; }
    const scheduledTitles = new Set(schedules.map((s) => s.title));
    const target = tasks.find((t) => !scheduledTitles.has(t.title)) ?? tasks[0];
    try {
      await addSchedule({ title: target.title, start_min: startMin, end_min: startMin + DEFAULT_DURATION_MIN });
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <nav className="flex items-center gap-2 p-4 bg-white border-b flex-shrink-0 overflow-x-auto">
        {TABS.filter((t) => t.id !== 'settings').map((t) => (
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
        <button
          onClick={() => goToTab('settings')}
          className={
            'ml-auto px-3 py-1 text-sm font-semibold rounded transition-colors flex-shrink-0 ' +
            (tab === 'settings'
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
          }
        >
          설정
        </button>
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
                onEditTitle={changeTitle}
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
          <FocusMap addTask={addTask} focusSeed={focusMapSeed} />
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

      {tab === 'worries' && (
        <UnconsciousWorries
          onFocusMap={(worry) => {
            setFocusMapSeed({ key: `${worry.id}-${Date.now()}`, goal: worry.title });
            goToTab('focusmap');
          }}
        />
      )}


      {tab === 'settings' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <WebhookSettings />
        </div>
      )}

      {tab === 'longgoals' && (
        <LongGoals />
      )}

      {tab === 'warroom' && (
        <WarRoomBoard />
      )}

      {tab === 'dailynote' && (
        <DailyNote />
      )}

      {tab === 'meetings' && (
        <MeetingMinutes />
      )}

      <div className="flex-shrink-0 border-t bg-white px-4 py-2">
        <div className="flex justify-end">
          <BackupControls scope={backupScope} />
        </div>
      </div>
    </div>
  );
}
