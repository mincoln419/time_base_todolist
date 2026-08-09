const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/tickets — 전체 고객사의 티켓 목록 조회 (캘린더용, 고객사명 포함)
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT tickets.*, customers.name AS customer_name
    FROM tickets
    JOIN customers ON customers.id = tickets.customer_id
    ORDER BY (tickets.desired_date IS NULL), tickets.desired_date ASC, tickets.id ASC
  `).all();
  res.json(rows);
});

// PATCH /api/tickets/:id/toggle — 등록 상태(registered) 반전
router.patch('/:id/toggle', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const registered = ticket.registered ? 0 : 1;
  db.prepare('UPDATE tickets SET registered = ? WHERE id = ?').run(registered, req.params.id);
  res.json(db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id));
});

// PATCH /api/tickets/:id/desired-date — 희망 일자 수정 (빈 값이면 해제)
router.patch('/:id/desired-date', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const { desired_date } = req.body;
  db.prepare('UPDATE tickets SET desired_date = ? WHERE id = ?').run(desired_date || null, req.params.id);
  res.json(db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id));
});

// DELETE /api/tickets/:id — 티켓 삭제
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

module.exports = router;
