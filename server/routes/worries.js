const express = require('express');
const db = require('../db/database');

const router = express.Router();

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function worryExistsOnDate(worry, date) {
  const created = dateOnly(worry.created_at);
  const completed = dateOnly(worry.completed_at);
  return created <= date && (!completed || completed >= date);
}

// GET /api/worries - 전체 고민 목록
router.get('/', (req, res) => {
  const active = db
    .prepare('SELECT * FROM unconscious_worries WHERE completed_at IS NULL ORDER BY created_at DESC, id DESC')
    .all();
  const completed = db
    .prepare('SELECT * FROM unconscious_worries WHERE completed_at IS NOT NULL ORDER BY completed_at DESC, id DESC')
    .all();

  res.json({ active, completed });
});

// POST /api/worries - 고민 추가
router.post('/', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '고민할 내용을 입력해주세요.' });
  }

  const result = db.prepare('INSERT INTO unconscious_worries (title) VALUES (?)').run(title.trim());
  const worry = db.prepare('SELECT * FROM unconscious_worries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(worry);
});

// PATCH /api/worries/:id/complete - 완료 목록으로 이동
router.patch('/:id/complete', (req, res) => {
  const current = db.prepare('SELECT * FROM unconscious_worries WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '찾을 수 없습니다.' });

  if (!current.completed_at) {
    db.prepare("UPDATE unconscious_worries SET completed_at = datetime('now', 'localtime') WHERE id = ?")
      .run(req.params.id);
  }

  res.json(db.prepare('SELECT * FROM unconscious_worries WHERE id = ?').get(req.params.id));
});

// GET /api/worries/daily?date=YYYY-MM-DD - 특정 날짜의 체크 표
router.get('/daily', (req, res) => {
  const { date } = req.query;
  if (!isDateString(date)) return res.status(400).json({ error: 'date 파라미터가 필요합니다.' });

  const rows = db
    .prepare(`
      SELECT
        w.id,
        w.title,
        w.created_at,
        w.completed_at,
        COALESCE(a.attempted, 0) AS attempted
      FROM unconscious_worries w
      LEFT JOIN unconscious_worry_attempts a
        ON a.worry_id = w.id AND a.date = ?
      WHERE substr(w.created_at, 1, 10) <= ?
        AND (w.completed_at IS NULL OR substr(w.completed_at, 1, 10) >= ?)
      ORDER BY w.completed_at IS NOT NULL ASC, w.created_at ASC, w.id ASC
    `)
    .all(date, date, date);

  res.json({
    date,
    worries: rows,
    stats: {
      attempted: rows.filter((row) => row.attempted === 1).length,
      total: rows.length,
    },
  });
});

// PUT /api/worries/:id/attempts/:date - 날짜별 해결 시도 체크
router.put('/:id/attempts/:date', (req, res) => {
  const { id, date } = req.params;
  const attempted = req.body.attempted ? 1 : 0;

  if (!isDateString(date)) return res.status(400).json({ error: '올바른 날짜가 아닙니다.' });

  const worry = db.prepare('SELECT * FROM unconscious_worries WHERE id = ?').get(id);
  if (!worry) return res.status(404).json({ error: '찾을 수 없습니다.' });
  if (!worryExistsOnDate(worry, date)) {
    return res.status(400).json({ error: '해당 날짜의 고민 목록에 포함되지 않습니다.' });
  }

  if (attempted) {
    db.prepare(`
      INSERT INTO unconscious_worry_attempts (worry_id, date, attempted)
      VALUES (?, ?, 1)
      ON CONFLICT(worry_id, date) DO UPDATE SET attempted = 1
    `).run(id, date);
  } else {
    db.prepare('DELETE FROM unconscious_worry_attempts WHERE worry_id = ? AND date = ?').run(id, date);
  }

  res.json({ worry_id: Number(id), date, attempted });
});

// GET /api/worries/stats?year=YYYY&month=1-12 - 캘린더 배지 통계
router.get('/stats', (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year와 month 파라미터가 필요합니다.' });
  }

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const worries = db
    .prepare(`
      SELECT * FROM unconscious_worries
      WHERE substr(created_at, 1, 10) <= ?
        AND (completed_at IS NULL OR substr(completed_at, 1, 10) >= ?)
    `)
    .all(monthEnd, monthStart);
  const attempts = db
    .prepare(`
      SELECT worry_id, date FROM unconscious_worry_attempts
      WHERE attempted = 1 AND date BETWEEN ? AND ?
    `)
    .all(monthStart, monthEnd);

  const attemptedByDate = attempts.reduce((acc, row) => {
    (acc[row.date] ??= new Set()).add(row.worry_id);
    return acc;
  }, {});

  const stats = [];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const total = worries.filter((worry) => worryExistsOnDate(worry, date)).length;
    const attempted = worries.filter((worry) => {
      return worryExistsOnDate(worry, date) && attemptedByDate[date]?.has(worry.id);
    }).length;
    stats.push({ date, attempted, total });
  }

  res.json({ year, month, stats });
});

module.exports = router;
