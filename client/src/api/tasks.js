const BASE = '/api/tasks';

export async function fetchTasks() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('할일 목록 조회 실패');
  return res.json();
}

export async function createTask(title) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function deleteTask(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제 실패');
}
