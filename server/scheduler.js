const db = require('./db/database');
const { sendWorkStartNotification } = require('./services/notifications');

const CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 시작 시간이 지난 '예정' 일정을 점검

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function checkAndAdvance() {
  const today = todayString();
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const toAdvance = db
    .prepare("SELECT * FROM schedules WHERE date = ? AND status = 'planned' AND start_min <= ?")
    .all(today, currentMin);

  for (const s of toAdvance) {
    // 그 사이 사용자가 상태를 바꿨다면(예: 완료 처리) 덮어쓰지 않는다
    const result = db
      .prepare("UPDATE schedules SET status = 'in_progress' WHERE id = ? AND status = 'planned'")
      .run(s.id);
    if (result.changes === 0) continue;

    sendWorkStartNotification(s.title).catch((e) => console.error('[scheduler] 알림 전송 실패:', e.message));
  }
}

// 서버가 켜져 있는 한 브라우저 탭 상태와 무관하게 동작하는 서버사이드 스케쥴러
function startScheduler() {
  checkAndAdvance().catch((e) => console.error('[scheduler] 점검 실패:', e.message));
  setInterval(() => {
    checkAndAdvance().catch((e) => console.error('[scheduler] 점검 실패:', e.message));
  }, CHECK_INTERVAL_MS);
}

module.exports = { startScheduler };
