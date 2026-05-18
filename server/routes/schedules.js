const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/schedules?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });

  const rows = db.prepare('SELECT * FROM schedules WHERE date = ? ORDER BY start_hour ASC').all(date);
  res.json(rows);
});

// POST /api/schedules — DnD 드롭 시 스케줄 생성
router.post('/', (req, res) => {
  const { title, date, start_hour, end_hour } = req.body;

  if (!title || !title.trim() || !date || start_hour == null || end_hour == null) {
    return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
  }
  if (end_hour <= start_hour) {
    return res.status(400).json({ error: 'end_hour는 start_hour보다 커야 합니다.' });
  }

  try {
    const result = db
      .prepare('INSERT INTO schedules (title, date, start_hour, end_hour) VALUES (?, ?, ?, ?)')
      .run(title.trim(), date, start_hour, end_hour);

    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: '해당 시간대에 이미 일정이 있습니다.' });
    }
    throw e;
  }
});

// PUT /api/schedules/:id — 상태 또는 시간 수정
router.put('/:id', (req, res) => {
  const { status, start_hour, end_hour } = req.body;
  const id = req.params.id;

  const current = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const newStatus = status ?? current.status;
  const newStart = start_hour ?? current.start_hour;
  const newEnd = end_hour ?? current.end_hour;

  db.prepare('UPDATE schedules SET status = ?, start_hour = ?, end_hour = ? WHERE id = ?')
    .run(newStatus, newStart, newEnd, id);

  res.json(db.prepare('SELECT * FROM schedules WHERE id = ?').get(id));
});

// DELETE /api/schedules/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

module.exports = router;
