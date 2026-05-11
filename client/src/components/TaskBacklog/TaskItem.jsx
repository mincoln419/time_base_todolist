import { useDraggable } from '@dnd-kit/core';

export default function TaskItem({ task, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { type: 'task', taskId: task.id, title: task.title },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded cursor-grab active:cursor-grabbing select-none"
      {...attributes}
      {...listeners}
    >
      <span className="text-sm truncate">{task.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        className="ml-2 text-gray-400 hover:text-red-500 text-xs flex-shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        ✕
      </button>
    </div>
  );
}
