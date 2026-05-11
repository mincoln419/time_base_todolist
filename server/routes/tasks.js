const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/tasks — 백로그 전체 조회
router.get('/', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY position ASC, id ASC').all();
  res.json(tasks);
});

// POST /api/tasks — 할일 추가
router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '제목을 입력해주세요.' });
  }

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM tasks').get().p;
  const result = db.prepare('INSERT INTO tasks (title, position) VALUES (?, ?)').run(title.trim(), maxPos + 1);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

// DELETE /api/tasks/:id — 할일 삭제 (CASCADE로 schedules도 삭제)
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

module.exports = router;
