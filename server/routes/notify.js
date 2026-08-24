const express = require('express');
const db = require('../db/database');

const router = express.Router();

// POST /api/notify/work-start — 등록된 활성 웹훅 전체에 업무 시작 알림 전송
router.post('/work-start', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title이 필요합니다.' });
  }

  const webhooks = db.prepare('SELECT * FROM notification_webhooks WHERE enabled = 1').all();
  if (webhooks.length === 0) {
    return res.status(204).send();
  }

  const trimmedTitle = title.trim();
  const message = `${trimmedTitle} 업무 시간입니다`;

  // 트리거 요청 스키마가 실제로 인식하는 필드는 이것뿐 — title 등 그 외 속성은 스키마에 없어 버려짐
  const payload = {
    type: 'message',
    attachments: [{ contentType: 'text/plain', content: message }],
  };

  const results = await Promise.all(
    webhooks.map(async (w) => {
      try {
        const response = await fetch(w.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
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

  res.json({ message, results });
});

module.exports = router;
