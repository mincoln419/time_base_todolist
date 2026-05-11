import { useDroppable } from '@dnd-kit/core';
import StatusBadge from './StatusBadge';

export default function TimeBlock({ block, onStatusChange, onTimeChange, onRemove }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeblock-${block.id}`,
    data: { type: 'timeblock', blockId: block.id },
  });

  const handleHourChange = (field, val) => {
    const v = parseInt(val, 10);
    if (isNaN(v)) return;
    if (field === 'start') onTimeChange(block.id, v, Math.max(v + 1, block.end_hour));
    else onTimeChange(block.id, block.start_hour, v);
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
          value={block.start_hour}
          onChange={(e) => handleHourChange('start', e.target.value)}
          className="border rounded px-1 py-0.5 text-sm bg-white"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
          ))}
        </select>
        <span>~</span>
        <select
          value={block.end_hour}
          onChange={(e) => handleHourChange('end', e.target.value)}
          className="border rounded px-1 py-0.5 text-sm bg-white"
        >
          {Array.from({ length: 24 }, (_, i) => i + 1)
            .filter((h) => h > block.start_hour)
            .map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
        </select>
        <span className="text-xs">시</span>
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
