const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/webhooks — 등록된 알림 웹훅 전체 조회
router.get('/', (req, res) => {
  const webhooks = db.prepare('SELECT * FROM notification_webhooks ORDER BY id ASC').all();
  res.json(webhooks);
});

// POST /api/webhooks — 웹훅 등록
router.post('/', (req, res) => {
  const { name, url } = req.body;
  if (!name || !name.trim() || !url || !url.trim()) {
    return res.status(400).json({ error: '이름과 URL을 입력해주세요.' });
  }

  const result = db
    .prepare('INSERT INTO notification_webhooks (name, url) VALUES (?, ?)')
    .run(name.trim(), url.trim());
  const webhook = db.prepare('SELECT * FROM notification_webhooks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(webhook);
});

// PUT /api/webhooks/:id — 이름/URL/활성화 여부 수정
router.put('/:id', (req, res) => {
  const { name, url, enabled } = req.body;
  const id = req.params.id;

  const current = db.prepare('SELECT * FROM notification_webhooks WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: '찾을 수 없습니다.' });

  if (name != null && !name.trim()) {
    return res.status(400).json({ error: '이름은 비워둘 수 없습니다.' });
  }
  if (url != null && !url.trim()) {
    return res.status(400).json({ error: 'URL은 비워둘 수 없습니다.' });
  }

  const newName = name != null ? name.trim() : current.name;
  const newUrl = url != null ? url.trim() : current.url;
  const newEnabled = enabled != null ? (enabled ? 1 : 0) : current.enabled;

  db.prepare('UPDATE notification_webhooks SET name = ?, url = ?, enabled = ? WHERE id = ?')
    .run(newName, newUrl, newEnabled, id);

  res.json(db.prepare('SELECT * FROM notification_webhooks WHERE id = ?').get(id));
});

// DELETE /api/webhooks/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM notification_webhooks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

module.exports = router;
