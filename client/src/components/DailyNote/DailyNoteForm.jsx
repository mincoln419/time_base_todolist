import { useState } from 'react';
import { noteKeywords } from './noteUtils';
import { extractDailyNoteTags } from '../../api/dailyNotes';

const MAX_CONTENT_LENGTH = 2000;

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// initialNote가 있으면 DB에 저장된 값, 없으면(신규 작성) 빈 초안 — "되돌리기"가 돌아갈 기준점으로도 재사용
function buildFields(initialNote, defaultDate) {
  return initialNote
    ? {
        date: initialNote.date,
        category: initialNote.category ?? '',
        item: initialNote.item ?? '',
        content: initialNote.content ?? '',
        tags: noteKeywords(initialNote),
      }
    : {
        date: defaultDate || toDateString(new Date()),
        category: '',
        item: '',
        content: '',
        tags: [],
      };
}

export default function DailyNoteForm({ initialNote, defaultDate, onSubmit, onCancel }) {
  const [original] = useState(() => buildFields(initialNote, defaultDate));
  const [draft, setDraft] = useState(() => ({
    date: original.date,
    category: original.category,
    item: original.item,
    content: original.content,
  }));
  const [tags, setTags] = useState(() => original.tags);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  const setField = (field) => (e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }));

  const commitTag = () => {
    const value = tagInput.trim();
    setTagInput('');
    if (!value) return;
    setTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
  };

  const removeTag = (tag) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleExtractTags = async () => {
    if (!draft.content.trim()) {
      setAiError('먼저 내용을 입력해주세요.');
      return;
    }
    setAiBusy(true);
    setAiError('');
    try {
      const result = await extractDailyNoteTags(draft.content);
      setDraft((prev) => ({ ...prev, category: result.category || prev.category }));
      if (result.keywords?.length) {
        setTags(result.keywords);
        setTagInput('');
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleRevert = () => {
    setDraft({
      date: original.date,
      category: original.category,
      item: original.item,
      content: original.content,
    });
    setTags(original.tags);
    setTagInput('');
    setError('');
    setAiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pendingTag = tagInput.trim();
    const finalTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
    if (finalTags.length === 0) {
      setError('키워드를 1개 이상 입력해주세요.');
      return;
    }
    try {
      await onSubmit({ ...draft, keyword: finalTags.join(', ') });
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
          <span className="block mb-1 text-gray-600">카테고리</span>
          <input
            type="text"
            value={draft.category}
            onChange={setField('category')}
            placeholder="예: 습관"
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="text-sm col-span-2">
          <span className="block mb-1 text-gray-600">키워드(태그) *</span>
          <div className="flex flex-wrap items-center gap-1.5 w-full px-2 py-1.5 border rounded focus-within:ring-2 focus-within:ring-blue-300">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-blue-400 hover:text-blue-700"
                  aria-label={`${tag} 삭제`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTag}
              placeholder={tags.length === 0 ? '키워드 입력 후 Enter 또는 , (해시태그처럼 여러 개 가능)' : '추가'}
              className="flex-1 min-w-[8rem] px-1 py-0.5 text-sm outline-none"
            />
          </div>
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
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="text-sm text-gray-600">내용 (마크다운)</span>
          <button
            type="button"
            onClick={handleExtractTags}
            disabled={aiBusy}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-50"
          >
            {aiBusy ? '추출 중...' : '태그추출(AI)'}
          </button>
        </div>
        <textarea
          value={draft.content}
          onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value.slice(0, MAX_CONTENT_LENGTH) }))}
          maxLength={MAX_CONTENT_LENGTH}
          rows="8"
          placeholder="마크다운 문법으로 자유롭게 기록 (AI가 정리한 내용을 붙여넣어도 좋습니다)"
          className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono"
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-xs text-red-500">{aiError}</span>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{draft.content.length}/{MAX_CONTENT_LENGTH}</span>
        </div>
        {!aiError && (
          <p className="mt-0.5 text-[11px] text-gray-400">
            AI가 추출한 카테고리·키워드는 입력란에만 채워지며, 저장을 눌러야 실제로 반영됩니다.
          </p>
        )}
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
          type="button"
          onClick={handleRevert}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          되돌리기
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
