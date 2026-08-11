const express = require('express');
const db = require('../db/database');

const router = express.Router();

function toData(body) {
  return JSON.stringify({
    items: body.items ?? [],
    step: body.step ?? 0,
    cursor: body.cursor ?? 0,
    addedTaskIds: body.addedTaskIds ?? [],
  });
}

function serialize(row) {
  const data = JSON.parse(row.data);
  return {
    id: row.id,
    goal: row.goal,
    items: data.items,
    step: data.step,
    cursor: data.cursor,
    addedTaskIds: data.addedTaskIds,
    updatedAt: row.updated_at,
  };
}

// GET /api/focusmap — 저장된 세션 요약 리스트 (updated_at desc)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM focus_map ORDER BY updated_at DESC').all();
  const list = rows.map((row) => {
    const data = JSON.parse(row.data);
    const items = data.items || [];
    const goldCount = items.filter((it) => it.impact >= 4 && it.ability >= 4).length;
    return {
      id: row.id,
      goal: row.goal,
      updatedAt: row.updated_at,
      step: data.step,
      itemCount: items.length,
      goldCount,
    };
  });
  res.json(list);
});

// GET /api/focusmap/:id — 세션 전체 상태 조회
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM focus_map WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.json(serialize(row));
});

// POST /api/focusmap — 새 세션 생성
router.post('/', (req, res) => {
  const goal = (req.body.goal || '').trim();
  if (!goal) return res.status(400).json({ error: '목표를 입력해주세요.' });

  const dup = db.prepare('SELECT id FROM focus_map WHERE goal = ?').get(goal);
  if (dup) return res.status(409).json({ error: '이미 저장된 목표입니다.' });

  const result = db.prepare('INSERT INTO focus_map (goal, data) VALUES (?, ?)').run(goal, toData(req.body));
  const row = db.prepare('SELECT * FROM focus_map WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serialize(row));
});

// PUT /api/focusmap/:id — 세션 갱신 (upsert)
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM focus_map WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const goal = (req.body.goal || '').trim();
  if (!goal) return res.status(400).json({ error: '목표를 입력해주세요.' });

  const dup = db.prepare('SELECT id FROM focus_map WHERE goal = ? AND id != ?').get(goal, req.params.id);
  if (dup) return res.status(409).json({ error: '이미 저장된 목표입니다.' });

  db.prepare(`
    UPDATE focus_map SET goal = ?, data = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
  `).run(goal, toData(req.body), req.params.id);
  const row = db.prepare('SELECT * FROM focus_map WHERE id = ?').get(req.params.id);
  res.json(serialize(row));
});

// DELETE /api/focusmap/:id — 세션 삭제
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM focus_map WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

module.exports = router;
