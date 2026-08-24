import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import StatusBadge from './StatusBadge';
import { formatMinutes } from '../../utils/time';

const SELECT_STEP = 30; // 시작/종료 선택은 항상 30분 단위로 선택 가능

export default function TimeBlock({ block, onStatusChange, onTimeChange, onRemove, onEditTitle }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeblock-${block.id}`,
    data: { type: 'timeblock', blockId: block.id },
  });

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(block.title);

  const openEdit = () => {
    setDraftTitle(block.title);
    setEditing(true);
  };

  const saveEdit = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) return;
    if (trimmed === block.title) { setEditing(false); return; }
    try {
      await onEditTitle(block.id, trimmed);
      setEditing(false);
    } catch (e) {
      alert(e.message);
    }
  };

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

      {/* 편집 */}
      <button onClick={openEdit} className="text-gray-300 hover:text-blue-400 text-xs">
        ✎
      </button>

      {/* 상태 배지 */}
      <StatusBadge status={block.status} onChange={(s) => onStatusChange(block.id, s)} />

      {/* 삭제 (백로그 복귀) */}
      <button onClick={() => onRemove(block.id)} className="text-gray-300 hover:text-red-400 text-xs">
        ✕
      </button>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditing(false)}>
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-700 mb-2">할일 내용 수정</h3>
            <input
              autoFocus
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full border rounded px-2 py-1.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-sm text-gray-500 rounded hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={!draftTitle.trim()}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
