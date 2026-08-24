const express = require('express');
const db = require('../db/database');

const router = express.Router();

const BACKUP_TYPES = {
  full: {
    label: '전체',
    tables: [
      'tasks',
      'schedules',
      'focus_map',
      'customers',
      'tickets',
      'unconscious_worries',
      'unconscious_worry_attempts',
      'long_goal_rewards',
      'long_goal_requirements',
      'long_goal_subgoals',
      'long_goals',
      'bucket_list_items',
    ],
    deleteTables: [
      'tickets',
      'unconscious_worry_attempts',
      'unconscious_worries',
      'long_goal_rewards',
      'long_goal_requirements',
      'long_goal_subgoals',
      'long_goals',
      'bucket_list_items',
      'customers',
      'tasks',
      'schedules',
      'focus_map',
    ],
  },
  schedule: {
    label: '일정관리',
    tables: ['tasks', 'schedules'],
    deleteTables: ['tasks', 'schedules'],
  },
  focusmap: {
    label: '포커스 맵',
    tables: ['focus_map'],
    deleteTables: ['focus_map'],
  },
  customers: {
    label: '고객사 티켓',
    tables: ['customers', 'tickets'],
    deleteTables: ['tickets', 'customers'],
  },
  calendar: {
    label: '캘린더',
    tables: ['customers', 'tickets'],
    deleteTables: ['tickets', 'customers'],
  },
  worries: {
    label: '무의식 고민목록',
    tables: ['unconscious_worries', 'unconscious_worry_attempts'],
    deleteTables: ['unconscious_worry_attempts', 'unconscious_worries'],
  },
  longgoals: {
    label: '장기목표',
    tables: [
      'long_goals',
      'long_goal_subgoals',
      'long_goal_requirements',
      'long_goal_rewards',
      'bucket_list_items',
    ],
    deleteTables: [
      'long_goal_rewards',
      'long_goal_requirements',
      'long_goal_subgoals',
      'long_goals',
      'bucket_list_items',
    ],
  },
};

function getBackupType(type) {
  return BACKUP_TYPES[type] ? type : 'full';
}

function getTableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function insertRows(table, rows) {
  const allowed = new Set(getTableColumns(table));
  const columnsOf = (row) => Object.keys(row).filter((col) => allowed.has(col));
  let count = 0;

  for (const row of rows) {
    const cols = columnsOf(row);
    if (!cols.length) continue;

    const stmt = db.prepare(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
    );
    stmt.run(...cols.map((col) => row[col]));
    count += 1;
  }

  return count;
}

// GET /api/backup/export?type=TYPE — 선택한 화면 데이터를 JSON으로 내보내기
router.get('/export', (req, res) => {
  const type = getBackupType(req.query.type);
  const config = BACKUP_TYPES[type];
  const data = {};
  for (const table of config.tables) {
    data[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  res.json({ version: 2, type, label: config.label, exportedAt: new Date().toISOString(), data });
});

// POST /api/backup/import — 백업 파일의 type에 해당하는 데이터만 교체
router.post('/import', (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '올바른 백업 파일이 아닙니다.' });
  }

  const type = getBackupType(req.body.type);
  const config = BACKUP_TYPES[type];
  const counts = {};

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');

    for (const table of config.deleteTables) {
      db.exec(`DELETE FROM ${table}`);
    }

    for (const table of config.tables) {
      const rows = Array.isArray(data[table]) ? data[table] : [];
      counts[table] = insertRows(table, rows);
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    db.exec('PRAGMA foreign_keys = ON');
    return res.status(400).json({ error: '가져오기에 실패했습니다: ' + e.message });
  }
  db.exec('PRAGMA foreign_keys = ON');
  res.json({ type, label: config.label, imported: counts });
});

module.exports = router;
