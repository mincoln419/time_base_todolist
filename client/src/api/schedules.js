const BASE = '/api/schedules';

export async function fetchSchedules(date) {
  const res = await fetch(`${BASE}?date=${date}`);
  if (!res.ok) throw new Error('스케줄 조회 실패');
  return res.json();
}

export async function createSchedule({ title, date, start_hour, end_hour }) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, start_hour, end_hour }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function updateSchedule(id, patch) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('수정 실패');
  return res.json();
}

export async function deleteSchedule(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제 실패');
}
