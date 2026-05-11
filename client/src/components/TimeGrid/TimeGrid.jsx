import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import TimeBlock from './TimeBlock';

function EmptySlot({ hour }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${hour}`,
    data: { type: 'slot', hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 p-3 border border-dashed rounded-lg transition-colors ${
        isOver ? 'bg-blue-50 border-blue-400' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <span className="text-sm text-gray-400 w-16 flex-shrink-0">{String(hour).padStart(2, '0')}:00</span>
      <span className="text-xs text-gray-300">드래그하여 배치</span>
    </div>
  );
}

const WORK_HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9~18시

export default function TimeGrid({ schedules, onStatusChange, onTimeChange, onRemove, onAddBlock }) {
  const [newHour, setNewHour] = useState('');

  // 블록의 start_hour ~ end_hour 범위 전체를 점유로 계산
  const occupiedHours = new Set(
    schedules.flatMap((s) => Array.from({ length: s.end_hour - s.start_hour }, (_, i) => s.start_hour + i))
  );

  // 업무시간(9~18) 중 점유되지 않은 빈 슬롯
  const emptyWorkSlots = WORK_HOURS.filter((h) => !occupiedHours.has(h));

  const addBlock = () => {
    const h = parseInt(newHour, 10);
    if (isNaN(h)) return;
    onAddBlock(h);
    setNewHour('');
  };

  // 선택 가능한 시간: 전체 0~23 중 점유되지 않은 시간
  const selectableHours = Array.from({ length: 24 }, (_, i) => i).filter((h) => !occupiedHours.has(h));

  return (
    <div className="p-4 flex-1 overflow-y-auto">
      <h2 className="font-semibold text-gray-700 mb-3">시간 계획</h2>

      <div className="space-y-2">
        {/* 배치된 블록 */}
        {schedules.map((s) => (
          <TimeBlock
            key={s.id}
            block={s}
            onStatusChange={onStatusChange}
            onTimeChange={onTimeChange}
            onRemove={onRemove}
          />
        ))}

        {/* 업무시간(9~18) 빈 슬롯 */}
        {emptyWorkSlots.map((h) => (
          <EmptySlot key={h} hour={h} />
        ))}
      </div>

      {/* 시간 블록 추가 (드롭다운 선택) */}
      <div className="flex gap-2 mt-4">
        <select
          value={newHour}
          onChange={(e) => setNewHour(e.target.value)}
          className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">시간 선택</option>
          {selectableHours.map((h) => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
        <button
          onClick={addBlock}
          disabled={!newHour}
          className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + 추가
        </button>
      </div>
    </div>
  );
}
