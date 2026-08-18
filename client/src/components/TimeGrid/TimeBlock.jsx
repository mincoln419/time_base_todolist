import { useDroppable } from '@dnd-kit/core';
import StatusBadge from './StatusBadge';
import { formatMinutes } from '../../utils/time';

const SELECT_STEP = 30; // 시작/종료 선택은 항상 30분 단위로 선택 가능

export default function TimeBlock({ block, onStatusChange, onTimeChange, onRemove }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeblock-${block.id}`,
    data: { type: 'timeblock', blockId: block.id },
  });

  // 30분 그리드 + 기존 값(정각이 아닐 수 있음)을 합쳐 옵션 구성
  const gridStarts = [];
  for (let m = 0; m < 24 * 60; m += SELECT_STEP) gridStarts.push(m);
  const gridEnds = [...gridStarts.slice(1), 24 * 60];

  const startOptions = Array.from(new Set([...gridStarts, block.start_min])).sort((a, b) => a - b);
  const endOptions = Array.from(new Set([...gridEnds, block.end_min]))
    .filter((m) => m > block.start_min)
    .sort((a, b) => a - b);

  const handleTimeChange = (field, val) => {
    const v = parseInt(val, 10);
    if (isNaN(v)) return;
    if (field === 'start') onTimeChange(block.id, v, Math.max(v + SELECT_STEP, block.end_min));
    else onTimeChange(block.id, block.start_min, v);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
        isOver ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'
      }`}
    >
      {/* 시간 선택 */}
      <div className="flex items-center gap-1 text-sm text-gray-500 flex-shrink-0">
        <select
          value={block.start_min}
          onChange={(e) => handleTimeChange('start', e.target.value)}
          className="border rounded px-1 py-0.5 text-sm bg-white"
        >
          {startOptions.map((m) => (
            <option key={m} value={m}>{formatMinutes(m)}</option>
          ))}
        </select>
        <span>~</span>
        <select
          value={block.end_min}
          onChange={(e) => handleTimeChange('end', e.target.value)}
          className="border rounded px-1 py-0.5 text-sm bg-white"
        >
          {endOptions.map((m) => (
            <option key={m} value={m}>{formatMinutes(m)}</option>
          ))}
        </select>
      </div>

      {/* 할일 제목 */}
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{block.title}</span>

      {/* 상태 배지 */}
      <StatusBadge status={block.status} onChange={(s) => onStatusChange(block.id, s)} />

      {/* 삭제 (백로그 복귀) */}
      <button onClick={() => onRemove(block.id)} className="text-gray-300 hover:text-red-400 text-xs">
        ✕
      </button>
    </div>
  );
}
