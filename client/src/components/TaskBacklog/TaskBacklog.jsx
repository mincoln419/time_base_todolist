import { useState, useLayoutEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import TaskItem from './TaskItem';

const COLLAPSED_HEIGHT = 100; // px — 칩 2줄 + 컨테이너 padding 정도의 높이

export default function TaskBacklog({ tasks, onAdd, onDelete }) {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const listRef = useRef(null);
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' });

  // 할일이 2줄보다 많아 실제로 잘리는 경우에만 더보기/접기 버튼을 보여준다
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 1);
  }, [tasks]);

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };

  return (
    <div className="p-4 bg-white border-b">
      <h2 className="font-semibold text-gray-700 mb-3">할 일 목록</h2>

      <div
        ref={(node) => { setNodeRef(node); listRef.current = node; }}
        className={`flex flex-wrap gap-2 min-h-[48px] p-2 rounded border-2 border-dashed transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
        }`}
        style={{ maxHeight: expanded ? 'none' : COLLAPSED_HEIGHT, overflow: expanded ? 'visible' : 'hidden' }}
      >
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
          <span className="text-xs text-gray-400 self-center">할 일을 추가하거나 여기로 드래그하세요</span>
        )}
      </div>

      {overflowing && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-gray-500 hover:text-blue-600"
        >
          {expanded ? '접기 ▲' : `더보기 (총 ${tasks.length}개) ▼`}
        </button>
      )}

      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="새 할 일 입력"
          className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button type="submit" className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
          추가
        </button>
      </form>
    </div>
  );
}
