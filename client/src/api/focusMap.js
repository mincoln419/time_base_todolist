const BASE = '/api/focusmap';

export async function fetchFocusMap() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('포커스 맵 조회 실패');
  return res.json();
}

export async function saveFocusMap(state) {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error('포커스 맵 저장 실패');
  return res.json();
}

export async function resetFocusMap() {
  const res = await fetch(BASE, { method: 'DELETE' });
  if (!res.ok) throw new Error('포커스 맵 초기화 실패');
}
