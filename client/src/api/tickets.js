const BASE = '/api/tickets';

export async function fetchAllTickets() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('티켓 목록 조회 실패');
  return res.json();
}

export async function toggleTicket(id) {
  const res = await fetch(`${BASE}/${id}/toggle`, { method: 'PATCH' });
  if (!res.ok) throw new Error('상태 변경 실패');
  return res.json();
}

export async function updateDesiredDate(id, desiredDate) {
  const res = await fetch(`${BASE}/${id}/desired-date`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desired_date: desiredDate || null }),
  });
  if (!res.ok) throw new Error('희망 일자 변경 실패');
  return res.json();
}

export async function deleteTicket(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제 실패');
}
