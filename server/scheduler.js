const { firestore } = require('./db/firestore');
const { SCHEDULES } = require('./db/collections');
const { sendWorkStartNotification } = require('./services/notifications');

const CHECK_INTERVAL_MS = 60 * 1000; // 1분마다 시작 시간이 지난 '예정' 일정을 점검
const schedulesRef = firestore.collection(SCHEDULES);

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 그 사이 사용자가 상태를 바꿨다면(예: 완료 처리) 덮어쓰지 않는다 — SQL의
// "UPDATE ... WHERE status='planned'" 가드를 트랜잭션으로 재현.
async function tryAdvance(ref) {
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== 'planned') return null;
    tx.update(ref, { status: 'in_progress' });
    return snap.data();
  });
}

async function checkAndAdvance() {
  const today = todayString();
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  // date+status 동등 필터만 Firestore 쿼리로 걸고, start_min 범위 비교는 결과가 적으니
  // JS에서 걸러 별도 복합 인덱스(date+status+start_min)가 필요 없게 한다.
  const snap = await schedulesRef.where('date', '==', today).where('status', '==', 'planned').get();
  const toAdvance = snap.docs.filter((d) => d.data().start_min <= currentMin);

  for (const doc of toAdvance) {
    const advanced = await tryAdvance(doc.ref);
    if (!advanced) continue;
    sendWorkStartNotification(advanced.title).catch((e) => console.error('[scheduler] 알림 전송 실패:', e.message));
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
