const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/focusmap — 저장된 포커스 맵 세션 조회
router.get('/', (req, res) => {
  const row = db.prepare('SELECT data FROM focus_map WHERE id = 1').get();
  res.json(row ? JSON.parse(row.data) : null);
});

// PUT /api/focusmap — 세션 저장 (전체 상태를 JSON으로 upsert)
router.put('/', (req, res) => {
  const data = JSON.stringify(req.body);
  db.prepare(`
    INSERT INTO focus_map (id, data, updated_at) VALUES (1, ?, datetime('now', 'localtime'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(data);
  res.json(req.body);
});

// DELETE /api/focusmap — 세션 초기화
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM focus_map WHERE id = 1').run();
  res.status(204).send();
});

module.exports = router;
