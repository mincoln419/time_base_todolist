import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import DateNavigator from './components/DateNavigator';
import TaskBacklog from './components/TaskBacklog/TaskBacklog';
import TimeGrid from './components/TimeGrid/TimeGrid';
import { useTasks } from './hooks/useTasks';
import { useSchedules } from './hooks/useSchedules';

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [date, setDate] = useState(toDateString(new Date()));
  const [activeItem, setActiveItem] = useState(null); // DragOverlay용

  const { tasks, addTask, removeTask } = useTasks();
  const { schedules, addSchedule, changeStatus, changeTime, removeSchedule } = useSchedules(date);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
        await addSchedule({ task_id: src.taskId, start_hour: startHour, end_hour: startHour + 1 });
      } catch (e) {
        alert(e.message);
      }
    }

    // 시간 블록 → 백로그 (복귀)
    if (src.type === 'schedule' && dst.type === 'backlog') {
      await removeSchedule(src.scheduleId);
    }
  };

  // 수기 시간 블록 추가 (DnD 없이)
  const handleAddBlock = async (startHour) => {
    if (tasks.length === 0) { alert('먼저 할 일을 추가해주세요.'); return; }
    // 첫 번째 미배치 할일 자동 선택 (UX 단순화)
    const scheduledTaskIds = new Set(schedules.map((s) => s.task_id));
    const target = tasks.find((t) => !scheduledTaskIds.has(t.id)) ?? tasks[0];
    try {
      await addSchedule({ task_id: target.id, start_hour: startHour, end_hour: startHour + 1 });
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-gray-50">
        <DateNavigator date={date} onChange={setDate} />
        <TaskBacklog tasks={tasks} onAdd={addTask} onDelete={removeTask} />
        <TimeGrid
          schedules={schedules}
          onStatusChange={changeStatus}
          onTimeChange={changeTime}
          onRemove={removeSchedule}
          onAddBlock={handleAddBlock}
        />
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="px-3 py-2 bg-blue-100 border border-blue-300 rounded shadow-lg text-sm">
            {activeItem.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
