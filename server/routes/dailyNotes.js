const express = require('express');
const db = require('../db/database');

const router = express.Router();

const MAX_CONTENT_LENGTH = 2000;

function todayDateString() {
  const row = db.prepare("SELECT date('now', 'localtime') AS d").get();
  return row.d;
}

// GET /api/daily-notes — 목록 조회 (date 또는 month 쿼리로 필터링, date 우선)
router.get('/', (req, res) => {
  const { date, month } = req.query;
  let rows;
  if (date) {
    rows = db.prepare('SELECT * FROM daily_notes WHERE date = ? ORDER BY date DESC, id DESC').all(date);
  } else if (month) {
    rows = db.prepare("SELECT * FROM daily_notes WHERE date LIKE ? ORDER BY date DESC, id DESC").all(`${month}%`);
  } else {
    rows = db.prepare('SELECT * FROM daily_notes ORDER BY date DESC, id DESC').all();
  }
  res.json(rows);
});

// POST /api/daily-notes — 새 노트 생성
router.post('/', (req, res) => {
  const keyword = (req.body.keyword || '').trim();
  if (!keyword) return res.status(400).json({ error: '키워드를 입력해주세요.' });

  const content = req.body.content ?? '';
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: '내용은 2000자를 초과할 수 없습니다.' });
  }

  const date = (req.body.date || '').trim() || todayDateString();
  const category = (req.body.category || '').trim() || null;
  const relatedKeywords = (req.body.related_keywords || '').trim() || null;
  const item = (req.body.item || '').trim() || null;

  const result = db.prepare(`
    INSERT INTO daily_notes (date, keyword, category, related_keywords, item, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(date, keyword, category, relatedKeywords, item, content);

  const row = db.prepare('SELECT * FROM daily_notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// PUT /api/daily-notes/:id — 노트 수정 (전체 필드 upsert)
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM daily_notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '찾을 수 없습니다.' });

  const keyword = (req.body.keyword || '').trim();
  if (!keyword) return res.status(400).json({ error: '키워드를 입력해주세요.' });

  const content = req.body.content ?? '';
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: '내용은 2000자를 초과할 수 없습니다.' });
  }

  const date = (req.body.date || '').trim() || todayDateString();
  const category = (req.body.category || '').trim() || null;
  const relatedKeywords = (req.body.related_keywords || '').trim() || null;
  const item = (req.body.item || '').trim() || null;

  db.prepare(`
    UPDATE daily_notes
    SET date = ?, keyword = ?, category = ?, related_keywords = ?, item = ?, content = ?,
        updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(date, keyword, category, relatedKeywords, item, content, req.params.id);

  const row = db.prepare('SELECT * FROM daily_notes WHERE id = ?').get(req.params.id);
  res.json(row);
});

// DELETE /api/daily-notes/:id — 노트 삭제
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM daily_notes WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '찾을 수 없습니다.' });
  res.status(204).send();
});

module.exports = router;
