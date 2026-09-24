const BASE = '/api/reading';

async function readJsonOrThrow(res, fallbackMessage) {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }
  const body = await res.json().catch(() => ({}));
  throw new Error(body.error || fallbackMessage);
}

function jsonRequest(method, payload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

export async function fetchBooks() {
  const res = await fetch(`${BASE}/books`);
  return readJsonOrThrow(res, '독서기록 조회 실패');
}

export async function createBook(payload) {
  const res = await fetch(`${BASE}/books`, jsonRequest('POST', payload));
  return readJsonOrThrow(res, '책 추가 실패');
}

export async function updateBook(id, payload) {
  const res = await fetch(`${BASE}/books/${id}`, jsonRequest('PATCH', payload));
  return readJsonOrThrow(res, '책 수정 실패');
}

export async function deleteBook(id) {
  const res = await fetch(`${BASE}/books/${id}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '책 삭제 실패');
}

export async function putLog(bookId, date, pageTo) {
  const res = await fetch(`${BASE}/books/${bookId}/logs/${date}`, jsonRequest('PUT', { page_to: pageTo }));
  return readJsonOrThrow(res, '독서 기록 실패');
}

export async function deleteLog(bookId, date) {
  const res = await fetch(`${BASE}/books/${bookId}/logs/${date}`, { method: 'DELETE' });
  return readJsonOrThrow(res, '독서 기록 삭제 실패');
}
