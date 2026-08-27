const BASE = '/api/warroom';

async function readJsonOrThrow(res, fallbackMessage) {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || fallbackMessage);
}

export async function fetchBoard() {
  const res = await fetch(BASE);
  return readJsonOrThrow(res, '업무 배치 보드 조회 실패');
}

export async function createRail(payload) {
  const res = await fetch(`${BASE}/rails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '레일 추가 실패');
}

export async function renameRail(id, payload) {
  const res = await fetch(`${BASE}/rails/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '레일 이름 수정 실패');
}

export async function moveRail(id, direction) {
  const res = await fetch(`${BASE}/rails/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction }),
  });
  return readJsonOrThrow(res, '레일 순서 변경 실패');
}

export async function deleteRail(id) {
  const res = await fetch(`${BASE}/rails/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '레일 삭제 실패');
}

export async function createMember(payload) {
  const res = await fetch(`${BASE}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '인원 추가 실패');
}

export async function moveMember(id, railId) {
  const res = await fetch(`${BASE}/members/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rail_id: railId }),
  });
  return readJsonOrThrow(res, '인원 배치 변경 실패');
}

export async function deleteMember(id) {
  const res = await fetch(`${BASE}/members/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '인원 삭제 실패');
}

export async function addMemberTask(memberId, payload) {
  const res = await fetch(`${BASE}/members/${memberId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '업무 태그 추가 실패');
}

export async function setPrimaryTask(taskId, isPrimary) {
  const res = await fetch(`${BASE}/member-tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_primary: isPrimary }),
  });
  return readJsonOrThrow(res, '주요 업무 지정 실패');
}

export async function deleteMemberTask(taskId) {
  const res = await fetch(`${BASE}/member-tasks/${taskId}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '업무 태그 삭제 실패');
}
