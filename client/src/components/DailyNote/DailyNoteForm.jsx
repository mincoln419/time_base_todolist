import { useState } from 'react';

const MAX_CONTENT_LENGTH = 2000;

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyDraft(defaultDate) {
  return {
    date: defaultDate || toDateString(new Date()),
    keyword: '',
    category: '',
    related_keywords: '',
    item: '',
    content: '',
  };
}

export default function DailyNoteForm({ initialNote, defaultDate, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() =>
    initialNote
      ? {
          date: initialNote.date,
          keyword: initialNote.keyword,
          category: initialNote.category ?? '',
          related_keywords: initialNote.related_keywords ?? '',
          item: initialNote.item ?? '',
          content: initialNote.content ?? '',
        }
      : emptyDraft(defaultDate)
  );
  const [error, setError] = useState('');

  const setField = (field) => (e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!draft.keyword.trim()) {
      setError('키워드를 입력해주세요.');
      return;
    }
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded bg-white space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">날짜</span>
          <input
            type="date"
            value={draft.date}
            onChange={setField('date')}
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">키워드 *</span>
          <input
            type="text"
            value={draft.keyword}
            onChange={setField('keyword')}
            placeholder="핵심 키워드"
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">카테고리</span>
          <input
            type="text"
            value={draft.category}
            onChange={setField('category')}
            placeholder="예: 습관"
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-gray-600">연관 키워드</span>
          <input
            type="text"
            value={draft.related_keywords}
            onChange={setField('related_keywords')}
            placeholder="쉼표로 구분 (예: 운동, 명상)"
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="text-sm col-span-2">
          <span className="block mb-1 text-gray-600">항목</span>
          <input
            type="text"
            value={draft.item}
            onChange={setField('item')}
            placeholder="아이디어 제목"
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
      </div>

      <div>
        <span className="block mb-1 text-sm text-gray-600">내용 (마크다운)</span>
        <textarea
          value={draft.content}
          onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value.slice(0, MAX_CONTENT_LENGTH) }))}
          maxLength={MAX_CONTENT_LENGTH}
          rows="8"
          placeholder="마크다운 문법으로 자유롭게 기록 (AI가 정리한 내용을 붙여넣어도 좋습니다)"
          className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono"
        />
        <div className="mt-1 text-right text-[11px] text-gray-400">{draft.content.length}/{MAX_CONTENT_LENGTH}</div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          취소
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-500 text-white hover:bg-blue-600"
        >
          저장
        </button>
      </div>
    </form>
  );
}
