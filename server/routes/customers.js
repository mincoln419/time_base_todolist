const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/customers — 고객사 목록 조회
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY id ASC').all();
  res.json(rows);
});

// POST /api/customers — 고객사 추가
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '고객사명을 입력해주세요.' });
  }

  const result = db.prepare('INSERT INTO customers (name) VALUES (?)').run(name.trim());
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(customer);
});

// DELETE /api/customers/:id — 고객사 삭제 (CASCADE로 tickets도 삭제)
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

// GET /api/customers/:id/tickets — 해당 고객사의 티켓 목록 조회
router.get('/:id/tickets', (req, res) => {
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const rows = db.prepare('SELECT * FROM tickets WHERE customer_id = ? ORDER BY id ASC').all(req.params.id);
  res.json(rows);
});

// POST /api/customers/:id/tickets — 티켓 추가
router.post('/:id/tickets', (req, res) => {
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const { title, desired_date } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '제목을 입력해주세요.' });
  }

  const result = db
    .prepare('INSERT INTO tickets (customer_id, title, desired_date) VALUES (?, ?, ?)')
    .run(req.params.id, title.trim(), desired_date || null);
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(ticket);
});

module.exports = router;
