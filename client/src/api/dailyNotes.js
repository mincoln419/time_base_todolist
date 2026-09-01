const BASE = '/api/daily-notes';

export async function fetchDailyNotes() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('데일리노트 목록 조회 실패');
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

export async function deleteDailyNote(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('데일리노트 삭제 실패');
}
