import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchDailyNoteIndex,
  fetchDailyNotesByIds,
  createDailyNote,
  updateDailyNote,
  deleteDailyNote,
} from '../api/dailyNotes';

// 인덱스 항목 형태 — 서버 /index 응답과 같다 (본문 없음)
function toEntry(note) {
  return { id: note.id, date: note.date, item: note.item, keyword: note.keyword, category: note.category };
}

function sortEntries(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

// 데일리노트 상태: 제목·태그만 담은 인덱스(entries) + 본문을 읽어 둔 노트 캐시(notesById).
// 화면은 인덱스로 목록·개수·마인드맵을 그리고, 실제로 보여줄 노트만 ensureNotes(ids)로 본문을 읽는다.
export function useDailyNotes() {
  const [entries, setEntries] = useState([]);
  const [notesById, setNotesById] = useState({});
  const [loaded, setLoaded] = useState(false);
  const cacheRef = useRef(notesById);
  cacheRef.current = notesById;
  const pendingRef = useRef(new Set());

  useEffect(() => {
    fetchDailyNoteIndex().then((list) => {
      setEntries(list);
      setLoaded(true);
    });
  }, []);

  const ensureNotes = useCallback(async (ids) => {
    const missing = ids.filter((id) => !cacheRef.current[id] && !pendingRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => pendingRef.current.add(id));
    try {
      // 서버가 한 번에 받는 id 수 한도(50)에 맞춰 나눠 요청
      const chunks = [];
      for (let i = 0; i < missing.length; i += 50) chunks.push(missing.slice(i, i + 50));
      const notes = (await Promise.all(chunks.map(fetchDailyNotesByIds))).flat();
      setNotesById((prev) => {
        const next = { ...prev };
        for (const n of notes) next[n.id] = n;
        return next;
      });
    } finally {
      missing.forEach((id) => pendingRef.current.delete(id));
    }
  }, []);

  const remember = (note) => setNotesById((prev) => ({ ...prev, [note.id]: note }));

  // 수정 폼처럼 본문이 반드시 있어야 할 때 — 캐시에 없으면 그 노트만 읽어 온다
  const getNote = useCallback(async (id) => {
    if (cacheRef.current[id]) return cacheRef.current[id];
    const [note] = await fetchDailyNotesByIds([id]);
    if (note) remember(note);
    return note ?? null;
  }, []);

  const addNote = useCallback(async (note) => {
    const created = await createDailyNote(note);
    remember(created);
    setEntries((prev) => sortEntries([toEntry(created), ...prev]));
    return created;
  }, []);

  const editNote = useCallback(async (id, note) => {
    const updated = await updateDailyNote(id, note);
    remember(updated);
    setEntries((prev) => sortEntries(prev.map((e) => (e.id === id ? toEntry(updated) : e))));
    return updated;
  }, []);

  const removeNote = useCallback(async (id) => {
    await deleteDailyNote(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setNotesById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { entries, notesById, ensureNotes, getNote, loaded, addNote, editNote, removeNote };
}
