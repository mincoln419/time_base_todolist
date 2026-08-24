export async function notifyWorkStart(title) {
  const res = await fetch('/api/notify/work-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('알림 전송 실패');
}
