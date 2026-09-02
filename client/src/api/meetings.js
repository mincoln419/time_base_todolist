const BASE = '/api/meetings';

async function readJsonOrThrow(res, fallbackMessage) {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || fallbackMessage);
}

export async function fetchMeetings() {
  const res = await fetch(BASE);
  return readJsonOrThrow(res, '회의록 목록 조회 실패');
}

export async function createMeeting(payload) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '회의록 생성 실패');
}

export async function fetchMeetingDetail(id) {
  const res = await fetch(`${BASE}/${id}`);
  return readJsonOrThrow(res, '회의록 상세 조회 실패');
}

export async function deleteMeeting(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '회의록 삭제 실패');
}

export async function createOverallItem(meetingId, payload) {
  const res = await fetch(`${BASE}/${meetingId}/overall-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '전체 항목 추가 실패');
}

export async function updateOverallItem(id, payload) {
  const res = await fetch(`${BASE}/overall-items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '전체 항목 수정 실패');
}

export async function deleteOverallItem(id) {
  const res = await fetch(`${BASE}/overall-items/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '전체 항목 삭제 실패');
}

export async function createPartItem(meetingId, payload) {
  const res = await fetch(`${BASE}/${meetingId}/part-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '파트별 항목 추가 실패');
}

export async function updatePartItem(id, payload) {
  const res = await fetch(`${BASE}/part-items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '파트별 항목 수정 실패');
}

export async function deletePartItem(id) {
  const res = await fetch(`${BASE}/part-items/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '파트별 항목 삭제 실패');
}

export async function createActionItem(meetingId, payload) {
  const res = await fetch(`${BASE}/${meetingId}/action-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '액션아이템 추가 실패');
}

export async function updateActionItem(id, payload) {
  const res = await fetch(`${BASE}/action-items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow(res, '액션아이템 수정 실패');
}

export async function deleteActionItem(id) {
  const res = await fetch(`${BASE}/action-items/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '액션아이템 삭제 실패');
}

// AI 응답은 원문 길이/모델 추론 시간에 따라 최대 1~2분까지 걸릴 수 있어(실측 확인),
// 무한 대기 대신 명확한 실패로 끝나도록 3분 타임아웃을 둔다.
const GENERATE_TIMEOUT_MS = 180000;

export async function generateActionItems(meetingId, notes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${meetingId}/action-items/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
      signal: controller.signal,
    });
    return await readJsonOrThrow(res, 'AI 액션아이템 생성 실패');
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('AI 응답이 너무 오래 걸려 중단했습니다. 원문을 줄이거나 잠시 후 다시 시도해주세요.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
