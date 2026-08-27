const BASE = '/api/longgoals';

async function readJsonOrThrow(res, fallbackMessage) {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || fallbackMessage);
}

export async function fetchLongGoals() {
  const res = await fetch(BASE);
  return readJsonOrThrow(res, '장기목표 조회 실패');
}

export async function createLongGoal(payload) {
  const res = await fetch(`${BASE}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '장기목표 추가 실패');
}

export async function updateLongGoal(id, payload) {
  const res = await fetch(`${BASE}/goals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '장기목표 수정 실패');
}

export async function deleteLongGoal(id) {
  const res = await fetch(`${BASE}/goals/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '장기목표 삭제 실패');
}

export async function createSubgoal(goalId, payload) {
  const res = await fetch(`${BASE}/goals/${goalId}/subgoals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '세부 목표 추가 실패');
}

export async function updateSubgoal(id, payload) {
  const res = await fetch(`${BASE}/subgoals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '세부 목표 수정 실패');
}

export async function deleteSubgoal(id) {
  const res = await fetch(`${BASE}/subgoals/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '세부 목표 삭제 실패');
}

export async function createRequirement(goalId, payload) {
  const res = await fetch(`${BASE}/goals/${goalId}/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '필요 항목 추가 실패');
}

export async function updateRequirement(id, payload) {
  const res = await fetch(`${BASE}/requirements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '필요 항목 수정 실패');
}

export async function deleteRequirement(id) {
  const res = await fetch(`${BASE}/requirements/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '필요 항목 삭제 실패');
}

export async function createReward(goalId, payload) {
  const res = await fetch(`${BASE}/goals/${goalId}/rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '보상 추가 실패');
}

export async function updateReward(id, payload) {
  const res = await fetch(`${BASE}/rewards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '보상 수정 실패');
}

export async function deleteReward(id) {
  const res = await fetch(`${BASE}/rewards/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '보상 삭제 실패');
}

export async function createBucketItem(payload) {
  const res = await fetch(`${BASE}/bucket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '버킷리스트 추가 실패');
}

export async function updateBucketItem(id, payload) {
  const res = await fetch(`${BASE}/bucket/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '버킷리스트 수정 실패');
}

export async function deleteBucketItem(id) {
  const res = await fetch(`${BASE}/bucket/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '버킷리스트 삭제 실패');
}
