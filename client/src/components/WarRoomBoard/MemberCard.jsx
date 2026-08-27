import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';

export default function MemberCard({ member, onAddTask, onSetPrimary, onDeleteTask, onRequestDelete }) {
  const [taskInput, setTaskInput] = useState('');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `member-${member.id}`,
    data: { type: 'member', memberId: member.id },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const submitTask = (e) => {
    e.preventDefault();
    const v = taskInput.trim();
    if (!v) return;
    onAddTask(member.id, v);
    setTaskInput('');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-56 flex-shrink-0 bg-blue-50 border border-blue-200 rounded p-2 cursor-grab active:cursor-grabbing select-none"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold truncate">{member.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRequestDelete(member); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-2 text-gray-400 hover:text-red-500 text-xs flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {member.tasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {member.tasks.map((task) => (
            <span
              key={task.id}
              onClick={(e) => { e.stopPropagation(); onSetPrimary(task.id, !task.is_primary); }}
              onPointerDown={(e) => e.stopPropagation()}
              className={
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer ' +
                (task.is_primary
                  ? 'bg-amber-400 text-white font-semibold'
                  : 'bg-white border border-blue-200 text-gray-600 hover:border-blue-400')
              }
              title="클릭하여 주요 업무로 지정/해제"
            >
              {task.is_primary ? '★' : null}
              {task.title}
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={task.is_primary ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-red-500'}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={submitTask} className="flex gap-1 mt-2" onPointerDown={(e) => e.stopPropagation()}>
        <input
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="업무 태그 추가"
          className="flex-1 min-w-0 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button type="submit" className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0">
          +
        </button>
      </form>
    </div>
  );
}
