import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const noteMarked = new Marked({ gfm: true, breaks: true });

export function noteLabel(note) {
  return (note.item && note.item.trim()) || note.keyword;
}

export function renderNoteMarkdown(content) {
  if (!content) return '';
  return DOMPurify.sanitize(noteMarked.parse(content));
}
