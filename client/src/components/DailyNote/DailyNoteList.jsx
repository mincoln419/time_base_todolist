import { useState, useMemo } from 'react';
import { noteLabel, renderNoteMarkdown } from './noteUtils';

export default function DailyNoteList({ notes, onEdit, onDelete }) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.keyword, n.category, n.item].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [notes, filter]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="키워드 또는 카테고리로 필터링"
        className="w-full max-w-sm px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
      />

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">
          {notes.length === 0 ? '아직 작성된 아이디어가 없습니다.' : '조건에 맞는 노트가 없습니다.'}
        </p>
      )}

      {filtered.map((note) => (
        <div key={note.id} className="p-4 border rounded bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{note.date}</span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600">{note.keyword}</span>
              {note.category && (
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-600">{note.category}</span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => onEdit(note)} className="text-xs text-gray-500 hover:text-blue-600">수정</button>
              <button onClick={() => onDelete(note.id)} className="text-xs text-gray-500 hover:text-red-500">삭제</button>
            </div>
          </div>
          <h4 className="mt-2 font-semibold text-gray-800">{noteLabel(note)}</h4>
          {note.related_keywords && (
            <p className="mt-1 text-xs text-gray-400">연관 키워드: {note.related_keywords}</p>
          )}
          {note.content && (
            <div
              className="mt-2 text-sm text-gray-700 markdown-body"
              dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(note.content) }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
