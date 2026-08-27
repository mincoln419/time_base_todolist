import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import MemberCard from './MemberCard';

export default function Rail({ rail, members, isFirst, isLast, onRename, onMoveUp, onMoveDown, onRequestDelete, onAddTask, onSetPrimary, onDeleteTask, onRequestDeleteMember }) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(rail.name);
  const { setNodeRef, isOver } = useDroppable({ id: `rail-${rail.id}` });

  const saveName = () => {
    const v = nameInput.trim();
    setEditing(false);
    if (!v || v === rail.name) { setNameInput(rail.name); return; }
    onRename(rail.id, v);
  };

  return (
    <div className="p-4 bg-white border-b">
      <div className="flex items-center justify-between mb-3">
        {editing ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameInput(rail.name); setEditing(false); } }}
            className="px-2 py-1 text-sm font-semibold border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        ) : (
          <h3
            onClick={() => setEditing(true)}
            className="font-semibold text-gray-700 cursor-text hover:underline"
            title="클릭하여 이름 수정"
          >
            {rail.name}
          </h3>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            title="위로 이동"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            title="아래로 이동"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"
          >
            ▼
          </button>
          <button
            onClick={() => onRequestDelete(rail)}
            className="ml-2 text-xs text-gray-400 hover:text-red-500"
          >
            레일 삭제
          </button>
        </div>
      </div>

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
            onRequestDelete={onRequestDeleteMember}
          />
        ))}
        {members.length === 0 && (
          <span className="text-xs text-gray-400 self-center">배치된 인원이 없습니다</span>
        )}
      </div>
    </div>
  );
}
