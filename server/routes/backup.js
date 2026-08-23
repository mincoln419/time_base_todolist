const express = require('express');
const db = require('../db/database');

const router = express.Router();

const TABLES = [
  'tasks',
  'schedules',
  'focus_map',
  'customers',
  'tickets',
  'unconscious_worries',
  'unconscious_worry_attempts',
];

// GET /api/backup/export — 전체 데이터를 JSON으로 내보내기
router.get('/export', (req, res) => {
  const data = {};
  for (const table of TABLES) {
    data[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  res.json({ version: 1, exportedAt: new Date().toISOString(), data });
});

// POST /api/backup/import — 업로드한 JSON으로 전체 데이터 교체
router.post('/import', (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '올바른 백업 파일이 아닙니다.' });
  }

  const columnsOf = (rows) => (rows.length ? Object.keys(rows[0]) : []);
  const counts = {};

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');

    // 자식(FK 보유) 테이블부터 비운다
    db.exec('DELETE FROM tickets');
    db.exec('DELETE FROM unconscious_worry_attempts');
    db.exec('DELETE FROM unconscious_worries');
    db.exec('DELETE FROM customers');
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM schedules');
    db.exec('DELETE FROM focus_map');

    for (const table of TABLES) {
      const rows = Array.isArray(data[table]) ? data[table] : [];
      const cols = columnsOf(rows);
      if (cols.length) {
        const stmt = db.prepare(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        );
        for (const row of rows) stmt.run(...cols.map((c) => row[c]));
      }
      counts[table] = rows.length;
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    db.exec('PRAGMA foreign_keys = ON');
    return res.status(400).json({ error: '가져오기에 실패했습니다: ' + e.message });
  }
  db.exec('PRAGMA foreign_keys = ON');
  res.json({ imported: counts });
});

module.exports = router;
