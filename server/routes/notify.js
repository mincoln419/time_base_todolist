const express = require('express');
const { sendWorkStartNotification } = require('../services/notifications');

const router = express.Router();

// POST /api/notify/work-start — 등록된 활성 웹훅 전체에 업무 시작 알림 전송
router.post('/work-start', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title이 필요합니다.' });
  }

  const trimmedTitle = title.trim();
  const results = await sendWorkStartNotification(trimmedTitle);
  if (results.length === 0) return res.status(204).send();

  res.json({ message: `${trimmedTitle} 업무 시간입니다`, results });
});

module.exports = router;
