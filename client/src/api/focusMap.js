const BASE = '/api/focusmap';

export async function listFocusMaps() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('포커스 맵 목록 조회 실패');
  return res.json();
}

export async function fetchFocusMap(id) {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('포커스 맵 조회 실패');
  return res.json();
}

export async function createFocusMap(state) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function saveFocusMap(id, state) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}

export async function deleteFocusMap(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('포커스 맵 삭제 실패');
}
