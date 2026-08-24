import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import TimeBlock from './TimeBlock';
import { formatMinutes } from '../../utils/time';

function EmptySlot({ startMin }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${startMin}`,
    data: { type: 'slot', startMin },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 p-3 border border-dashed rounded-lg transition-colors ${
        isOver ? 'bg-blue-50 border-blue-400' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <span className="text-sm text-gray-400 w-16 flex-shrink-0">{formatMinutes(startMin)}</span>
      <span className="text-xs text-gray-300">드래그하여 배치</span>
    </div>
  );
}

const WORK_START_MIN = 9 * 60;
const WORK_END_MIN = 18 * 60; // 9~18시
const HOUR_STEP = 60;   // 뷰(빈 슬롯 목록)는 1시간 단위 고정
const SELECT_STEP = 30; // 셀렉트박스는 30분 단위로 선택 가능

export default function TimeGrid({ schedules, onEditTitle, onStatusChange, onTimeChange, onRemove, onAddBlock }) {
  const [newStart, setNewStart] = useState('');

  const isOccupied = (startMin) => schedules.some((s) => startMin >= s.start_min && startMin < s.end_min);

  // 업무시간(9~18) 중 점유되지 않은 빈 슬롯 — 1시간 단위
  const emptyWorkSlots = [];
  for (let m = WORK_START_MIN; m < WORK_END_MIN; m += HOUR_STEP) {
    if (!isOccupied(m)) emptyWorkSlots.push(m);
  }

  const addBlock = () => {
    const m = parseInt(newStart, 10);
    if (isNaN(m)) return;
    onAddBlock(m);
    setNewStart('');
  };

  // 선택 가능한 시간: 하루 전체 중 점유되지 않은 시간 — 30분 단위
  const selectableSlots = [];
  for (let m = 0; m < 24 * 60; m += SELECT_STEP) {
    if (!isOccupied(m)) selectableSlots.push(m);
  }

  return (
    <div className="p-4 flex-1 overflow-y-auto">
      <h2 className="font-semibold text-gray-700 mb-3">시간 계획</h2>

      <div className="space-y-2">
        {/* 배치된 블록 */}
        {schedules.map((s) => (
          <TimeBlock
            key={s.id}
            block={s}
            onEditTitle={onEditTitle}
            onStatusChange={onStatusChange}
            onTimeChange={onTimeChange}
            onRemove={onRemove}
          />
        ))}

        {/* 업무시간(9~18) 빈 슬롯 */}
        {emptyWorkSlots.map((m) => (
          <EmptySlot key={m} startMin={m} />
        ))}
      </div>

      {/* 시간 블록 추가 (드롭다운 선택) */}
      <div className="flex gap-2 mt-4">
        <select
          value={newStart}
          onChange={(e) => setNewStart(e.target.value)}
          className="px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">시간 선택</option>
          {selectableSlots.map((m) => (
            <option key={m} value={m}>{formatMinutes(m)}</option>
          ))}
        </select>
        <button
          onClick={addBlock}
          disabled={!newStart}
          className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + 추가
        </button>
      </div>
    </div>
  );
}
