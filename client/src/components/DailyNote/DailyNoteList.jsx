import { useState, useMemo, useEffect } from 'react';
import { noteLabel, noteKeywords, renderNoteMarkdown } from './noteUtils';

// 본문이 짧으면(줄바꿈 없고 대략 한 줄 길이) 접기/펼치기 버튼 자체를 표시하지 않는다
function isLongContent(content) {
  return !!content && (content.length > 60 || content.includes('\n'));
}

function NoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongContent(note.content);

  return (
    <div className="p-4 border rounded bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {long ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-gray-600"
              aria-label={expanded ? '접기' : '펼치기'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="flex-shrink-0 w-[1em]" />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{note.date}</span>
            {noteKeywords(note).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">#{tag}</span>
            ))}
            {note.category && (
              <span className="px-2 py-0.5 rounded bg-green-50 text-green-600">{note.category}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onEdit(note)} className="text-xs text-gray-500 hover:text-blue-600">수정</button>
          <button onClick={() => onDelete(note.id)} className="text-xs text-gray-500 hover:text-red-500">삭제</button>
        </div>
      </div>
      <h4 className="mt-2 font-semibold text-gray-800">{noteLabel(note)}</h4>
      {note.content && (
        <div
          className={'mt-2 text-sm text-gray-700 markdown-body' + (expanded ? '' : ' line-clamp-1')}
          dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(note.content) }}
        />
      )}
    </div>
  );
}

// 한 페이지에 보여줄 노트 수 — 페이지마다 본문을 이만큼만 읽는다
const PAGE_SIZE = 10;

// 목록은 제목·태그 인덱스(entries)로 필터·페이지를 나누고, 현재 페이지 노트만 본문을 읽는다
export default function DailyNoteList({ entries, notesById, ensureNotes, onEdit, onDelete }) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((n) =>
      [n.keyword, n.category, n.item].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [entries, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageEntries = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const pageKey = pageEntries.map((e) => e.id).join(',');

  useEffect(() => { setPage(0); }, [filter]);
  useEffect(() => {
    if (pageKey) ensureNotes(pageKey.split(',').map(Number)).catch(() => {});
  }, [pageKey, ensureNotes]);

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
          {entries.length === 0 ? '아직 작성된 아이디어가 없습니다.' : '조건에 맞는 노트가 없습니다.'}
        </p>
      )}

      {pageEntries.map((entry) => (
        notesById[entry.id]
          ? <NoteCard key={entry.id} note={notesById[entry.id]} onEdit={onEdit} onDelete={onDelete} />
          : <div key={entry.id} className="p-4 border rounded bg-white text-sm text-gray-400">불러오는 중…</div>
      ))}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm">
          <button
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >
            ◀ 이전
          </button>
          <span className="text-gray-500">{current + 1} / {pageCount}</span>
          <button
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >
            다음 ▶
          </button>
        </div>
      )}
    </div>
  );
}
