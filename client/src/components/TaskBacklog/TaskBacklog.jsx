import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import TaskItem from './TaskItem';

export default function TaskBacklog({ tasks, onAdd, onDelete }) {
  const [input, setInput] = useState('');
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' });

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
        ref={setNodeRef}
        className={`flex flex-wrap gap-2 min-h-[48px] p-2 rounded border-2 border-dashed transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
        }`}
      >
        {tasks.map((t) => (
          <TaskItem key={t.id} task={t} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
          <span className="text-xs text-gray-400 self-center">할 일을 추가하거나 여기로 드래그하세요</span>
        )}
      </div>

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
