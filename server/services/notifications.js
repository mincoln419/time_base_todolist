const { firestore } = require('../db/firestore');
const { NOTIFICATION_WEBHOOKS } = require('../db/collections');

// 등록된 활성 웹훅 전체에 업무 시작 알림 전송 — /api/notify 라우트와 scheduler.js가 공유
async function sendWorkStartNotification(title) {
  const snap = await firestore.collection(NOTIFICATION_WEBHOOKS).where('enabled', '==', 1).get();
  const webhooks = snap.docs.map((d) => d.data());
  if (webhooks.length === 0) return [];

  const message = `${title} 업무 시간입니다`;
  // 트리거 요청 스키마가 실제로 인식하는 필드는 이것뿐 — title 등 그 외 속성은 스키마에 없어 버려짐
  const payload = {
    type: 'message',
    attachments: [{ contentType: 'text/plain', content: message }],
  };

  return Promise.all(
    webhooks.map(async (w) => {
      try {
        const response = await fetch(w.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // 바디를 읽지 않으면 undici가 커넥션을 풀에 반환하지 못해 소켓이 계속 쌓인다 —
        // 1분마다 도는 스케쥴러라 실패가 반복되면 누적됨. 결과는 안 쓰지만 반드시 소비한다.
        await response.text().catch(() => {});
        if (!response.ok) {
          console.error(`[notify] 웹훅 "${w.name}" 전송 실패: ${response.status}`);
          return { id: w.id, ok: false };
        }
        return { id: w.id, ok: true };
      } catch (e) {
        console.error(`[notify] 웹훅 "${w.name}" 전송 오류:`, e.message);
        return { id: w.id, ok: false };
      }
    })
  );
}

module.exports = { sendWorkStartNotification };
