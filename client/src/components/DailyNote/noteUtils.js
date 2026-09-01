import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const noteMarked = new Marked({ gfm: true, breaks: true });

// 해시태그 스타일 다중 키워드 — keyword 컬럼에 쉼표로 구분해 저장된 값을 배열로 분리
export function noteKeywords(note) {
  return (note.keyword || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

export function noteLabel(note) {
  return (note.item && note.item.trim()) || noteKeywords(note)[0] || '';
}

export function renderNoteMarkdown(content) {
  if (!content) return '';
  return DOMPurify.sanitize(noteMarked.parse(content));
}
