const BASE = '/api/daily-notes';

// 제목·태그만 담은 경량 인덱스 — 목록 페이지·캘린더 개수·마인드맵용 (서버에서 문서 1건 읽기)
export async function fetchDailyNoteIndex() {
  const res = await fetch(`${BASE}/index`);
  if (!res.ok) throw new Error('데일리노트 목록 조회 실패');
  return res.json();
}

// 본문까지 필요한 노트만 id로 읽는다
export async function fetchDailyNotesByIds(ids) {
  if (ids.length === 0) return [];
  const res = await fetch(`${BASE}?ids=${ids.join(',')}`);
  if (!res.ok) throw new Error('데일리노트 조회 실패');
  return res.json();
}

export async function createDailyNote(note) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function updateDailyNote(id, note) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function extractDailyNoteTags(content) {
  const res = await fetch(`${BASE}/extract-tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function deleteDailyNote(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('데일리노트 삭제 실패');
}
