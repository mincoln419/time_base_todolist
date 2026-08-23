const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/todo.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// WAL 모드 + 외래키 활성화
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// DDL 초기화
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// 마이그레이션: 기존 DB에 tickets.desired_date 컬럼이 없으면 추가
const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all();
if (!ticketColumns.some((c) => c.name === 'desired_date')) {
  db.exec('ALTER TABLE tickets ADD COLUMN desired_date TEXT');
}

db.exec(`
CREATE TABLE IF NOT EXISTS unconscious_worries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS unconscious_worry_attempts (
  worry_id    INTEGER NOT NULL REFERENCES unconscious_worries(id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,
  attempted   INTEGER NOT NULL DEFAULT 1 CHECK (attempted IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (worry_id, date)
);
`);

module.exports = db;
