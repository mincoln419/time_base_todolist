const BASE = '/api/worries';

async function readJsonOrThrow(res, fallbackMessage) {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || fallbackMessage);
}

export async function fetchWorries() {
  const res = await fetch(BASE);
  return readJsonOrThrow(res, '고민 목록 조회 실패');
}

export async function createWorry(title) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return readJsonOrThrow(res, '고민 추가 실패');
}

export async function completeWorry(id, conclusion = '') {
  const res = await fetch(`${BASE}/${id}/complete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conclusion }),
  });
  return readJsonOrThrow(res, '고민 완료 처리 실패');
}

export async function updateWorryConclusion(id, conclusion = '') {
  const res = await fetch(`${BASE}/${id}/conclusion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conclusion }),
  });
  return readJsonOrThrow(res, '메모 수정 실패');
}

export async function restoreWorry(id) {
  const res = await fetch(`${BASE}/${id}/restore`, { method: 'PATCH' });
  return readJsonOrThrow(res, '고민 복원 실패');
}

export async function fetchDailyWorries(date) {
  const res = await fetch(`${BASE}/daily?date=${encodeURIComponent(date)}`);
  return readJsonOrThrow(res, '날짜별 고민 조회 실패');
}

export async function updateWorryAttempt(id, date, attempted) {
  const res = await fetch(`${BASE}/${id}/attempts/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attempted }),
  });
  return readJsonOrThrow(res, '해결 시도 체크 실패');
}

export async function fetchWorryStats(year, month) {
  const res = await fetch(`${BASE}/stats?year=${year}&month=${month}`);
  return readJsonOrThrow(res, '고민 통계 조회 실패');
}
