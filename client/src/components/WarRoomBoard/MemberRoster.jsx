import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import MemberCard from './MemberCard';

export default function MemberRoster({ members, onAdd, onAddTask, onSetPrimary, onDeleteTask, onRequestDelete }) {
  const [input, setInput] = useState('');
  const { setNodeRef, isOver } = useDroppable({ id: 'roster' });

  const submit = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };

  return (
    <div className="p-4 bg-white border-b">
      <h2 className="font-semibold text-gray-700 mb-3">미배치 인원</h2>

      <div
        ref={setNodeRef}
        className={`flex flex-wrap gap-2 min-h-[64px] p-2 rounded border-2 border-dashed transition-colors ${
          isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
        }`}
      >
        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            onAddTask={onAddTask}
            onSetPrimary={onSetPrimary}
            onDeleteTask={onDeleteTask}
            onRequestDelete={onRequestDelete}
          />
        ))}
        {members.length === 0 && (
          <span className="text-xs text-gray-400 self-center">인원을 추가하거나 여기로 드래그하세요</span>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2 mt-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="새 인원 이름"
          className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button type="submit" className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
          + 인원 추가
        </button>
      </form>
    </div>
  );
}
