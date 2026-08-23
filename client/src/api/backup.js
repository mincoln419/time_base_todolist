const BASE = '/api/backup';

export async function exportBackup(type = 'full') {
  const res = await fetch(`${BASE}/export?type=${encodeURIComponent(type)}`);
  if (!res.ok) throw new Error('내보내기 실패');
  return res.json();
}

export async function importBackup(payload) {
  const res = await fetch(`${BASE}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  return res.json();
}
